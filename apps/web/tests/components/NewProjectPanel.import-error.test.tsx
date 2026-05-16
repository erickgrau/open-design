// @vitest-environment jsdom

// Red spec for the silent Claude Design ZIP import failure.
//
// Symptom (issue: "Claude Design zip import fails silently"): clicking
// "Import Claude Design ZIP", picking a file, then nothing happens — no
// project, no error. The failure is swallowed at three layers and the
// panel never tells the user anything.
//
// This spec drives `onImportClaudeDesign` to a *failure* result and
// asserts the panel surfaces it the same way the sibling folder-import
// flow does: a dismissible Toast carrying the daemon's reason. It is red
// on `main` (the panel ignores the result) and green once the import
// path gains an error channel + Toast.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewProjectPanel } from '../../src/components/NewProjectPanel';
import type { DesignSystemSummary, SkillSummary } from '../../src/types';

const skills: SkillSummary[] = [
  {
    id: 'prototype-skill',
    name: 'Prototype',
    description: 'Build prototypes',
    mode: 'prototype',
    surface: 'web',
    previewType: 'html',
    designSystemRequired: true,
    defaultFor: ['prototype'],
    triggers: [],
    upstream: null,
    hasBody: true,
    examplePrompt: 'Build a prototype.',
    aggregatesExamples: false,
  },
];

const designSystems: DesignSystemSummary[] = [
  {
    id: 'clay',
    title: 'Clay',
    summary: 'Friendly tactile product UI.',
    category: 'Product',
    swatches: ['#f4efe7', '#25211d'],
  },
];

const originalResizeObserver = globalThis.ResizeObserver;
const originalScrollIntoView = Element.prototype.scrollIntoView;

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = originalResizeObserver;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('NewProjectPanel Claude Design ZIP import', () => {
  it('surfaces a Toast when the import fails instead of silently doing nothing', async () => {
    const onImportClaudeDesign = vi.fn().mockResolvedValue({
      ok: false,
      message: 'zip does not contain an HTML file',
    });

    const { container } = render(
      <NewProjectPanel
        skills={skills}
        designSystems={designSystems}
        defaultDesignSystemId="clay"
        templates={[]}
        onDeleteTemplate={vi.fn()}
        promptTemplates={[]}
        onCreate={vi.fn()}
        onImportClaudeDesign={onImportClaudeDesign}
      />,
    );

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const file = new File(['not a real zip'], 'broken.zip', {
      type: 'application/zip',
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(onImportClaudeDesign).toHaveBeenCalledWith(file);

    // The failure reason must reach the user. On `main` no Toast renders
    // and this find times out — that is the red.
    expect(
      await screen.findByText(/zip does not contain an HTML file/i),
    ).toBeTruthy();
  });
});
