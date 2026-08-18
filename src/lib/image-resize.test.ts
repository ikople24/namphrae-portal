import { describe, it, expect } from 'vitest';
import { fitDimensions } from '@/lib/image-resize';

describe('fitDimensions', () => {
  it('keeps images already within maxDim', () =>
    expect(fitDimensions(800, 600, 1920)).toEqual({ width: 800, height: 600 }));
  it('scales a landscape image so the long side equals maxDim', () =>
    expect(fitDimensions(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 }));
  it('scales a portrait image so the long side equals maxDim', () =>
    expect(fitDimensions(2000, 4000, 1920)).toEqual({ width: 960, height: 1920 }));
  it('handles squares', () =>
    expect(fitDimensions(4000, 4000, 1920)).toEqual({ width: 1920, height: 1920 }));
  it('rounds to integers', () =>
    expect(fitDimensions(3000, 2001, 1920)).toEqual({ width: 1920, height: 1281 }));
  it('is a no-op at the exact boundary', () =>
    expect(fitDimensions(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 }));
});
