import type { NitroErrorHandler } from 'nitropack';

function normalizeErrorLike(input: unknown) {
  if (input instanceof Error) {
    const errorRecord = input as unknown as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      name: input.name,
      message: input.message,
      stack: input.stack,
    };

    for (const key of [
      'code',
      'errno',
      'sqlState',
      'sqlMessage',
      'clientVersion',
      'originalCode',
      'originalMessage',
      'meta',
      'cause',
    ]) {
      const value = errorRecord[key];
      if (value !== undefined) {
        payload[key] = value;
      }
    }

    return payload;
  }

  if (input && typeof input === 'object') {
    return input;
  }

  return { value: input };
}

function getCauseChain(error: unknown, maxDepth = 8) {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < maxDepth; depth++) {
    if (!current || typeof current !== 'object' || seen.has(current)) {
      break;
    }

    seen.add(current);

    const cause = (current as { cause?: unknown }).cause;
    if (cause === undefined) {
      break;
    }

    chain.push(normalizeErrorLike(cause));
    current = cause;
  }

  return chain;
}

function safeJSONStringify(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
      value,
      (_, currentValue: unknown) => {
        if (typeof currentValue === 'bigint') {
          return currentValue.toString();
        }

        if (typeof currentValue === 'function') {
          return `[Function ${currentValue.name || 'anonymous'}]`;
        }

        if (typeof currentValue === 'symbol') {
          return currentValue.toString();
        }

        if (currentValue && typeof currentValue === 'object') {
          if (seen.has(currentValue)) {
            return '[Circular]';
          }

          seen.add(currentValue);
        }

        return currentValue;
      },
      2,
    );
  } catch (serializationError) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      message: 'Failed to serialize error payload',
      serializationError: normalizeErrorLike(serializationError),
    });
  }
}

const errorHandler: NitroErrorHandler = function (error, event) {
  const causeChain = getCauseChain(error);
  const payload = {
    timestamp: new Date().toISOString(),
    method: event.method,
    path: event.path,
    error: normalizeErrorLike(error),
    cause: causeChain[0] ?? null,
    cause2: causeChain[1] ?? null,
    causeChain,
  };

  try {
    console.error('[backend-mock] Unhandled error', safeJSONStringify(payload));
  } catch (logError) {
    console.error(
      '[backend-mock] Failed to log unhandled error',
      normalizeErrorLike(logError),
    );
  }

  const errorMessage =
    error instanceof Error ? (error.stack ?? error.message) : String(error);

  event.node.res.end(`[Error Handler] ${errorMessage}`);
};

export default errorHandler;
