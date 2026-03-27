import { getRelicDefinition, type LegacyRelicDefinition, type RelicContext, type RelicTrigger } from '../data/RelicDefinitions';

export class RelicManager {
    private relics: LegacyRelicDefinition[] = [];

    constructor() {
        this.relics = [];
    }

    reset(): void {
        this.relics = [];
    }

    addRelic(relicId: string): boolean {
        const relic = getRelicDefinition(relicId);
        if (!relic) return false;

        // Check if already owned
        if (this.hasRelic(relicId)) return false;

        this.relics.push(relic);
        return true;
    }

    hasRelic(relicId: string): boolean {
        return this.relics.some(r => r.id === relicId);
    }

    getRelics(): LegacyRelicDefinition[] {
        return [...this.relics];
    }

    trigger(trigger: RelicTrigger, context: RelicContext): void {
        for (const relic of this.relics) {
            for (const effect of relic.effects) {
                if (effect.trigger === trigger) {
                    effect.apply(context);
                }
            }
        }
    }

    applyPassiveEffects(context: RelicContext): void {
        this.trigger('passive', context);
    }
}

let relicManagerInstance: RelicManager | null = null;

export function getRelicManager(): RelicManager {
    if (!relicManagerInstance) {
        relicManagerInstance = new RelicManager();
    }
    return relicManagerInstance;
}

export function resetRelicManager(): void {
    if (relicManagerInstance) {
        relicManagerInstance.reset();
    }
}
