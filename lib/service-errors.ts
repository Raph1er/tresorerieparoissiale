function obtenirMessagesErreur(error: unknown, visited = new Set<object>()): string[] {
  if (typeof error === "string") {
    return [error];
  }
  if (!error || typeof error !== "object" || visited.has(error)) {
    return [];
  }

  visited.add(error);
  const record = error as Record<string, unknown>;
  const messages = ["message", "details", "hint", "code", "cause"]
    .flatMap((key) => obtenirMessagesErreur(record[key], visited));

  return messages;
}

export function estErreurIndisponibiliteService(error: unknown): boolean {
  const message = obtenirMessagesErreur(error).join(" ");
  return /fetch failed|connecttimeout|und_err_connect_timeout|etimedout|econnrefused|econnreset|enotfound|eai_again|networkerror/i.test(message);
}

export function formaterErreurServeur(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause instanceof Error
        ? { name: error.cause.name, message: error.cause.message }
        : error.cause,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object") {
    return error as Record<string, unknown>;
  }

  return { message: String(error) };
}
