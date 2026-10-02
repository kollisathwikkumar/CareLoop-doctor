import { useEffect, useRef, type RefObject } from 'react';
import { Platform } from 'react-native';

type TuneElement = HTMLElement;

let runtimePromise: Promise<void> | null = null;

function startStringTune(): Promise<void> {
  if (Platform.OS !== 'web') return Promise.resolve();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return Promise.resolve();
  if (runtimePromise) return runtimePromise;

  runtimePromise = import('@fiddle-digital/string-tune').then((module) => {
    const tune = module.default.getInstance();
    tune.scrollDesktopMode = 'default';
    tune.scrollMobileMode = 'default';
    tune.use(module.StringMagnetic);
    tune.start(60);
  });

  return runtimePromise;
}

export function useStringTuneRuntime(): void {
  useEffect(() => {
    void startStringTune();
  }, []);
}

export function useStringTuneElement<T extends object = object>(
  attributes: Record<string, string>,
  className: string,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !ref.current) return;
    const element = ref.current as unknown as TuneElement;
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    element.classList.add(className);
    void startStringTune();
  }, [attributes, className]);

  return ref;
}
