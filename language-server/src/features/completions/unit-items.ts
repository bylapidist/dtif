import { CompletionItemKind, type CompletionItem } from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../../core/documents/analysis-store.js';
import { parentPointer } from '../../pointer-utils.js';
import { getStringProperty } from '../../core/json-tree.js';

const LENGTH_UNITS = [
  'px',
  'rem',
  'em',
  'ex',
  'ch',
  'vw',
  'vh',
  'vmin',
  'vmax',
  '%',
  'cm',
  'mm',
  'in',
  'pt',
  'pc',
  'dp',
  'sp',
  'q'
] as const;

const ANGLE_UNITS = ['deg', 'rad', 'grad', 'turn'] as const;
const RESOLUTION_UNITS = ['dpi', 'dpcm', 'dppx'] as const;
const DURATION_TIME_UNITS = ['ms', 's'] as const;
const DURATION_FRAME_UNITS = ['frames'] as const;
const DURATION_FRACTION_UNITS = ['%'] as const;

export function buildUnitCompletionItems(
  store: DocumentAnalysisStore,
  uri: string,
  pointer: string
): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  const parent = parentPointer(pointer);
  const parentNode = parent ? store.getPointerNode(uri, parent) : undefined;

  const dimensionType = getStringProperty(parentNode, 'dimensionType');
  if (dimensionType) {
    for (const unit of getDimensionUnits(dimensionType)) {
      addUnit(items, seen, unit, 'Dimension unit', `1_${unit}`);
    }
  }

  const durationType = getStringProperty(parentNode, 'durationType');
  if (durationType) {
    for (const unit of getDurationUnits(durationType)) {
      addUnit(items, seen, unit, 'Duration unit', `1_${unit}`);
    }
  }

  for (const unit of store.getUnitValues()) {
    addUnit(items, seen, unit, 'Observed in workspace', `2_${unit}`);
  }

  if (items.length === 0) {
    const fallback = new Set<string>([
      ...LENGTH_UNITS,
      ...ANGLE_UNITS,
      ...RESOLUTION_UNITS,
      ...DURATION_TIME_UNITS,
      ...DURATION_FRAME_UNITS,
      ...DURATION_FRACTION_UNITS
    ]);
    for (const unit of fallback) {
      addUnit(items, seen, unit, 'Common unit', `9_${unit}`);
    }
  }

  return items;
}

function addUnit(
  items: CompletionItem[],
  seen: Set<string>,
  unit: string,
  detail: string,
  sortText: string
): void {
  if (seen.has(unit)) {
    return;
  }
  items.push({
    label: unit,
    kind: CompletionItemKind.Unit,
    detail,
    sortText
  } satisfies CompletionItem);
  seen.add(unit);
}

function getDimensionUnits(dimensionType: string): readonly string[] {
  switch (dimensionType) {
    case 'length':
      return LENGTH_UNITS;
    case 'angle':
      return ANGLE_UNITS;
    case 'resolution':
      return RESOLUTION_UNITS;
    default:
      return [];
  }
}

function getDurationUnits(durationType: string): readonly string[] {
  if (durationType.endsWith('frame-count')) {
    return DURATION_FRAME_UNITS;
  }

  if (durationType.endsWith('fraction') || durationType.endsWith('progress')) {
    return DURATION_FRACTION_UNITS;
  }

  return DURATION_TIME_UNITS;
}
