export type DiffCellStatus = "same" | "added" | "removed" | "changed" | "empty";

export interface TextCompareOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export interface DiffSegment {
  changed: boolean;
  value: string;
}

export interface DiffCell {
  lineNumber: number | null;
  segments: DiffSegment[];
  status: DiffCellStatus;
  text: string;
}

export interface DiffRow {
  left: DiffCell;
  right: DiffCell;
}

export interface TextCompareSummary {
  addedLines: number;
  changedLines: number;
  hasDifferences: boolean;
  identicalLines: number;
  leftLineCount: number;
  removedLines: number;
  rightLineCount: number;
  similarity: number;
  totalRows: number;
}

export interface TextCompareResult {
  rows: DiffRow[];
  summary: TextCompareSummary;
}

type EqualOp<T> = {
  left: T;
  leftIndex: number;
  right: T;
  rightIndex: number;
  type: "equal";
};

type RemoveOp<T> = {
  left: T;
  leftIndex: number;
  type: "remove";
};

type AddOp<T> = {
  right: T;
  rightIndex: number;
  type: "add";
};

type DiffOp<T> = EqualOp<T> | RemoveOp<T> | AddOp<T>;

const splitLines = (text: string) => {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").split("\n");
};

const normalizeToken = (value: string, options: TextCompareOptions) => {
  let normalized = value;

  if (options.ignoreWhitespace) {
    normalized = /^\s+$/.test(normalized) ? " " : normalized.trim();
  }

  if (options.ignoreCase) {
    normalized = normalized.toLocaleLowerCase("pt-BR");
  }

  return normalized;
};

const normalizeLine = (value: string, options: TextCompareOptions) => {
  let normalized = value;

  if (options.ignoreWhitespace) {
    normalized = normalized.replace(/\s+/g, " ").trim();
  }

  if (options.ignoreCase) {
    normalized = normalized.toLocaleLowerCase("pt-BR");
  }

  return normalized;
};

const buildDiffOperations = <T,>(
  left: readonly T[],
  right: readonly T[],
  isEqual: (leftValue: T, rightValue: T) => boolean,
): DiffOp<T>[] => {
  const matrix = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      matrix[leftIndex][rightIndex] = isEqual(left[leftIndex], right[rightIndex])
        ? matrix[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(matrix[leftIndex + 1][rightIndex], matrix[leftIndex][rightIndex + 1]);
    }
  }

  const operations: DiffOp<T>[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (isEqual(left[leftIndex], right[rightIndex])) {
      operations.push({
        left: left[leftIndex],
        leftIndex: leftIndex + 1,
        right: right[rightIndex],
        rightIndex: rightIndex + 1,
        type: "equal",
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
      operations.push({
        left: left[leftIndex],
        leftIndex: leftIndex + 1,
        type: "remove",
      });
      leftIndex += 1;
      continue;
    }

    operations.push({
      right: right[rightIndex],
      rightIndex: rightIndex + 1,
      type: "add",
    });
    rightIndex += 1;
  }

  while (leftIndex < left.length) {
    operations.push({
      left: left[leftIndex],
      leftIndex: leftIndex + 1,
      type: "remove",
    });
    leftIndex += 1;
  }

  while (rightIndex < right.length) {
    operations.push({
      right: right[rightIndex],
      rightIndex: rightIndex + 1,
      type: "add",
    });
    rightIndex += 1;
  }

  return operations;
};

const mergeSegments = (segments: DiffSegment[]) => {
  if (segments.length <= 1) return segments;

  const merged: DiffSegment[] = [];

  for (const segment of segments) {
    if (!segment.value) continue;

    const previous = merged[merged.length - 1];

    if (previous && previous.changed === segment.changed) {
      previous.value += segment.value;
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
};

const buildInlineSegments = (leftText: string, rightText: string, options: TextCompareOptions) => {
  const tokenize = (value: string) => value.match(/[A-Za-zÀ-ÿ0-9_]+|\s+|[^\s]/g) ?? [];
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);

  const operations = buildDiffOperations(
    leftTokens,
    rightTokens,
    (leftToken, rightToken) => normalizeToken(leftToken, options) === normalizeToken(rightToken, options),
  );

  const leftSegments: DiffSegment[] = [];
  const rightSegments: DiffSegment[] = [];

  for (const operation of operations) {
    if (operation.type === "equal") {
      leftSegments.push({ changed: false, value: operation.left });
      rightSegments.push({ changed: false, value: operation.right });
      continue;
    }

    if (operation.type === "remove") {
      leftSegments.push({ changed: true, value: operation.left });
      continue;
    }

    rightSegments.push({ changed: true, value: operation.right });
  }

  return {
    leftSegments: mergeSegments(leftSegments),
    rightSegments: mergeSegments(rightSegments),
  };
};

const emptyCell = (): DiffCell => ({
  lineNumber: null,
  segments: [],
  status: "empty",
  text: "",
});

const createCell = (
  text: string,
  lineNumber: number | null,
  status: Exclude<DiffCellStatus, "empty">,
  segments?: DiffSegment[],
): DiffCell => ({
  lineNumber,
  segments: segments && segments.length > 0 ? segments : [{ changed: false, value: text }],
  status,
  text,
});

export const buildTextCompareResult = (
  leftText: string,
  rightText: string,
  options: TextCompareOptions = {},
): TextCompareResult => {
  const leftLines = splitLines(leftText);
  const rightLines = splitLines(rightText);
  const operations = buildDiffOperations(
    leftLines,
    rightLines,
    (leftLine, rightLine) => normalizeLine(leftLine, options) === normalizeLine(rightLine, options),
  );

  const rows: DiffRow[] = [];
  const pendingRemovals: RemoveOp<string>[] = [];
  const pendingAdditions: AddOp<string>[] = [];

  const flushPending = () => {
    if (pendingRemovals.length === 0 && pendingAdditions.length === 0) return;

    const changedCount = Math.min(pendingRemovals.length, pendingAdditions.length);

    for (let index = 0; index < changedCount; index += 1) {
      const removal = pendingRemovals[index];
      const addition = pendingAdditions[index];
      const inlineSegments = buildInlineSegments(removal.left, addition.right, options);

      rows.push({
        left: createCell(removal.left, removal.leftIndex, "changed", inlineSegments.leftSegments),
        right: createCell(addition.right, addition.rightIndex, "changed", inlineSegments.rightSegments),
      });
    }

    for (let index = changedCount; index < pendingRemovals.length; index += 1) {
      const removal = pendingRemovals[index];

      rows.push({
        left: createCell(removal.left, removal.leftIndex, "removed"),
        right: emptyCell(),
      });
    }

    for (let index = changedCount; index < pendingAdditions.length; index += 1) {
      const addition = pendingAdditions[index];

      rows.push({
        left: emptyCell(),
        right: createCell(addition.right, addition.rightIndex, "added"),
      });
    }

    pendingRemovals.length = 0;
    pendingAdditions.length = 0;
  };

  for (const operation of operations) {
    if (operation.type === "equal") {
      flushPending();

      rows.push({
        left: createCell(operation.left, operation.leftIndex, "same"),
        right: createCell(operation.right, operation.rightIndex, "same"),
      });
      continue;
    }

    if (operation.type === "remove") {
      pendingRemovals.push(operation);
      continue;
    }

    pendingAdditions.push(operation);
  }

  flushPending();

  const identicalLines = rows.filter((row) => row.left.status === "same" && row.right.status === "same").length;
  const changedLines = rows.filter((row) => row.left.status === "changed" && row.right.status === "changed").length;
  const removedLines = rows.filter((row) => row.left.status === "removed").length;
  const addedLines = rows.filter((row) => row.right.status === "added").length;
  const totalComparableLines = Math.max(leftLines.length, rightLines.length, 1);
  const similarity = Math.round((identicalLines / totalComparableLines) * 100);

  return {
    rows,
    summary: {
      addedLines,
      changedLines,
      hasDifferences: addedLines + changedLines + removedLines > 0,
      identicalLines,
      leftLineCount: leftLines.length,
      removedLines,
      rightLineCount: rightLines.length,
      similarity,
      totalRows: rows.length,
    },
  };
};
