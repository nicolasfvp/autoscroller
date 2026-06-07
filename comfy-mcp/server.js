#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, mkdirSync, createWriteStream, existsSync, readdirSync, renameSync, copyFileSync } from 'node:fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import http from 'http';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COMFY_HOST = 'localhost';
const COMFY_PORT = 8188;
const OUTPUT_ROOT = join(PROJECT_ROOT, 'comfy');
const DEFAULT_REFERENCE_IMAGE = join(PROJECT_ROOT, 'public/assets/characters/monsters/desert/baby dragon_1.png');

const KEYS_PATH = join(__dirname, 'keys.json');
const COMFY_API_KEY = existsSync(KEYS_PATH)
  ? (JSON.parse(readFileSync(KEYS_PATH, 'utf8')).api_key_comfy_org ?? null)
  : null;

// ── Helpers ────────────────────────────────────────────────────────────────

function loadWorkflow(name = 'workflow') {
  const p = join(__dirname, `${name}.json`);
  if (!existsSync(p)) throw new Error(`Workflow not found: ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Find the primary prompt node. Returns { id, field } where field is the
 * input key to patch with the user's prompt text.
 *
 * Priority:
 *   1. OpenAIGPTImageNodeV2  → field "prompt"
 *   2. CLIPTextEncode with "positive" in title → field "text"
 *   3. First CLIPTextEncode found → field "text"
 */
function findPromptTarget(workflow) {
  const entries = Object.entries(workflow);

  for (const [id, node] of entries) {
    if (node.class_type === 'OpenAIGPTImageNodeV2') {
      return { id, field: 'prompt' };
    }
  }
  for (const [id, node] of entries) {
    const title = (node._meta?.title ?? '').toLowerCase();
    if (node.class_type === 'CLIPTextEncode' && title.includes('positive')) {
      return { id, field: 'text' };
    }
  }
  for (const [id, node] of entries) {
    if (node.class_type === 'CLIPTextEncode') {
      return { id, field: 'text' };
    }
  }
  return null;
}

function post(path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: COMFY_HOST, port: COMFY_PORT, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: COMFY_HOST, port: COMFY_PORT, path }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    }).on('error', reject);
  });
}

function waitForCompletion(promptId, clientId, timeoutMs = 600_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${COMFY_HOST}:${COMFY_PORT}/ws?clientId=${clientId}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Generation timed out (10 min)')); }, timeoutMs);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'executing'
          && msg.data?.prompt_id === promptId
          && msg.data?.node === null) {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch { /* ignore non-JSON frames */ }
    });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function downloadFile(filename, subfolder, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  const url = `/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder ?? '')}&type=output`;
  return new Promise((resolve, reject) => {
    http.get({ hostname: COMFY_HOST, port: COMFY_PORT, path: url }, (res) => {
      const stream = createWriteStream(destPath);
      res.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Upload a local image file to ComfyUI's input folder.
 * Reads the entire file into memory first to avoid streaming edge cases on Windows.
 * Returns the filename as registered by ComfyUI.
 */
function uploadImage(localPath) {
  let fileBytes;
  try {
    fileBytes = readFileSync(localPath);
  } catch (e) {
    return Promise.reject(new Error(`Cannot read file for upload (${localPath}): ${e.message}`));
  }

  const filename = basename(localPath);
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileBytes, tail]);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: COMFY_HOST, port: COMFY_PORT,
        path: '/upload/image', method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const json = JSON.parse(raw);
            if (json.error) reject(new Error(`ComfyUI upload error: ${json.error}`));
            else resolve(json.name ?? filename);
          } catch {
            reject(new Error(`Upload response not JSON (status ${res.statusCode}): ${raw.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', e => reject(new Error(`HTTP error during upload: ${e.message}`)));
    req.write(body);
    req.end();
  });
}

function err(msg) {
  return { content: [{ type: 'text', text: `❌ ${msg}` }] };
}

/**
 * Resolve and upload a reference image to ComfyUI, patching all LoadImage
 * nodes in the workflow. Mutates workflow in place.
 */
async function applyReferenceImage(workflow, reference_image) {
  const ref = String(reference_image);
  // Try as absolute path first, then relative to project root
  const resolvedPath = existsSync(ref) ? ref : join(PROJECT_ROOT, ref);
  if (!existsSync(resolvedPath)) {
    return `reference_image not found: ${ref}`;
  }
  const uploadedName = await uploadImage(resolvedPath);
  for (const node of Object.values(workflow)) {
    if (node.class_type === 'LoadImage') node.inputs.image = uploadedName;
  }
  return null; // no error
}

/** Download all outputs (images + videos) into destFolder, named {stem}{suffix}{ext}. */
async function saveOutputs(images, videos, destFolder, stem, output_path) {
  const saved = [];
  const items = [
    ...images.map((f, i) => ({ ...f, defaultExt: '.png', i })),
    ...videos.map((f, i) => ({ ...f, defaultExt: '.mp4', i })),
  ];
  for (const { filename, subfolder, defaultExt, i } of items) {
    const suffix = i === 0 ? '' : `_${i + 1}`;
    const ext = extname(filename) || defaultExt;
    const destPath = join(destFolder, `${stem}${suffix}${ext}`);
    try {
      await downloadFile(filename, subfolder, destPath);
      saved.push(`comfy/${output_path}/${stem}${suffix}${ext}`);
    } catch (e) {
      saved.push(`❌ download failed (${filename}): ${e.message}`);
    }
  }
  return saved;
}

/**
 * Post-process a sprite animation folder:
 * - All PNG frames stay (they're all usable sprites with transparent bg)
 * - Video moves to arquivo/
 */
function finalizeSpritesAsset(destFolder) {
  const arquivoDir = join(destFolder, 'arquivo');
  mkdirSync(arquivoDir, { recursive: true });
  for (const file of readdirSync(destFolder)) {
    if (file === 'arquivo') continue;
    if (extname(file) !== '.png') renameSync(join(destFolder, file), join(arquivoDir, file));
  }
}

/**
 * Post-process a monster asset folder:
 * - Frames _3 and _5 become _1 and _2 (the idle animation pair)
 * - Everything else moves to arquivo/
 */
function finalizeMonsterAsset(destFolder, stem) {
  const arquivoDir = join(destFolder, 'arquivo');
  mkdirSync(arquivoDir, { recursive: true });

  const src3 = join(destFolder, `${stem}_3.png`);
  const src5 = join(destFolder, `${stem}_5.png`);

  if (existsSync(src3)) copyFileSync(src3, join(destFolder, `${stem}_1.png`));
  if (existsSync(src5)) copyFileSync(src5, join(destFolder, `${stem}_2.png`));

  for (const file of readdirSync(destFolder)) {
    if (file === 'arquivo') continue;
    if (file === `${stem}_1.png` || file === `${stem}_2.png`) continue;
    renameSync(join(destFolder, file), join(arquivoDir, file));
  }
}

async function queueAndWait(workflow) {
  const clientId = randomUUID();
  const payload = { prompt: workflow, client_id: clientId };
  if (COMFY_API_KEY) payload.extra_data = { api_key_comfy_org: COMFY_API_KEY };
  const res = await post('/prompt', payload);
  const promptId = res.prompt_id;
  if (!promptId) throw new Error(`Queue rejected: ${JSON.stringify(res)}`);
  await waitForCompletion(promptId, clientId);
  return promptId;
}

function resolveTarget(workflow, nodeId) {
  if (!nodeId) return findPromptTarget(workflow);
  const field = workflow[nodeId]?.class_type === 'OpenAIGPTImageNodeV2' ? 'prompt' : 'text';
  return { id: nodeId, field };
}

/** Collect all image and video outputs from a completed prompt's history. */
function collectOutputs(history, promptId) {
  const outputs = history[promptId]?.outputs ?? {};
  const images = [];
  const videos = [];

  for (const nodeOut of Object.values(outputs)) {
    if (nodeOut.images) images.push(...nodeOut.images);
    if (nodeOut.videos) videos.push(...nodeOut.videos);
    if (nodeOut.gifs)   videos.push(...nodeOut.gifs);
  }

  return { images, videos };
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'comfyui', version: '1.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'generate_asset',
      description:
        'Generate an image (and video) asset with ComfyUI. ' +
        'All outputs are saved inside a named folder under comfy/. ' +
        'Example: generate_asset({ prompt: "pixel art desert mummy", output_path: "monster/desert/mummy", workflow: "image_video" })',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Positive text prompt for image generation',
          },
          output_path: {
            type: 'string',
            description:
              'Destination path inside comfy/. The last segment becomes the filename stem. ' +
              'E.g. "monster/desert/mummy" → comfy/monster/desert/mummy/mummy.png + mummy.mp4',
          },
          workflow: {
            type: 'string',
            description:
              'Name of the workflow file inside comfy-mcp/ (without .json). ' +
              'Defaults to "workflow". Use "image_video" for the image+video pipeline.',
          },
          reference_image: {
            type: 'string',
            description:
              'Optional: absolute or project-relative path to a local image used as style reference. ' +
              'Uploaded to ComfyUI automatically before generation. ' +
              'If omitted, the image already set in the workflow is used.',
          },
          prompt_node_id: {
            type: 'string',
            description: 'Optional: explicit node ID for the prompt node. Auto-detected when omitted.',
          },
        },
        required: ['prompt', 'output_path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'generate_asset') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  /** @type {{prompt:string,output_path:string,workflow?:string,reference_image?:string,prompt_node_id?:string}} */
  const { prompt, output_path, workflow: workflowName, reference_image, prompt_node_id } =
    request.params.arguments;

  // 1. Load workflow
  let workflow;
  try {
    workflow = loadWorkflow(workflowName ?? 'workflow');
  } catch (e) {
    return err(e.message);
  }

  // 2. Patch prompt node (optional — workflows without a prompt node are allowed)
  const target = resolveTarget(workflow, prompt_node_id);
  if (target && prompt) {
    workflow[target.id].inputs[target.field] = prompt;
  }

  // 3. Upload & patch reference image (uses default if not provided)
  const refImage = reference_image ? String(reference_image) : DEFAULT_REFERENCE_IMAGE;
  try {
    const uploadErr = await applyReferenceImage(workflow, refImage);
    if (uploadErr) return err(uploadErr);
  } catch (e) {
    const detail = e instanceof Error ? `${e.message}\n${e.stack}` : JSON.stringify(e);
    return err(`Failed to upload reference image:\n${detail}`);
  }

  // 4. Queue prompt and wait for completion
  let promptId;
  try {
    promptId = await queueAndWait(workflow);
  } catch (e) {
    return err(`Generation failed: ${e.message}`);
  }

  // 6. Collect & save outputs
  const history = await get(`/history/${promptId}`);
  const { images, videos } = collectOutputs(history, promptId);
  if (!images.length && !videos.length) {
    const entry = history[promptId] ?? {};
    const status = entry.status ?? {};
    const messages = (status.messages ?? [])
      .map(([type, data]) => `[${type}] ${JSON.stringify(data).slice(0, 300)}`)
      .join('\n');
    return err(
      `Generation finished but no output files found.\n` +
      `Status: ${status.status_str ?? 'unknown'}\n` +
      (messages ? `Messages:\n${messages}` : 'No error messages in history.'),
    );
  }

  const stem = basename(output_path);
  const destFolder = join(OUTPUT_ROOT, output_path);
  mkdirSync(destFolder, { recursive: true });

  await saveOutputs(images, videos, destFolder, stem, output_path);

  const wf = workflowName ?? 'workflow';
  if (wf === 'image_video') finalizeMonsterAsset(destFolder, stem);
  else if (wf === 'image_to_sprites' || wf === 'image_to_sprites_portrait') finalizeSpritesAsset(destFolder);

  const finalFiles = readdirSync(destFolder)
    .filter(f => f !== 'arquivo')
    .map(f => `   • comfy/${output_path}/${f}`);

  return {
    content: [{
      type: 'text',
      text: `✅ comfy/${output_path}/\n${finalFiles.join('\n')}` +
            (target ? `\n   Prompt: "${prompt}"\n   Node: #${target.id} (field: ${target.field})` : ''),
    }],
  };
});

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
