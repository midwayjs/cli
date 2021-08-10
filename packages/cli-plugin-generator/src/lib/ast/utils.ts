import { SourceFile } from 'ts-morph';

export type LifeCycleMethod = 'onReady' | 'onStop';

export type MidwayPropDecorator = 'Inject' | 'App';

export const LIFE_CYCLE_METHODS: LifeCycleMethod[] = ['onReady', 'onStop'];

export const LIFE_CYCLE_CLASS_IDENTIFIER = 'ContainerLifeCycle';
