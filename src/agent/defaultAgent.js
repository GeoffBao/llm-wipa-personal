function asAsyncIterable(value) {
  if (value && typeof value[Symbol.asyncIterator] === 'function') return value;
  return (async function* () { if (value != null) yield value; })();
}

function agentMessages(messages, context) {
  return [
    {
      role: 'system',
      content: `${context?.promptContext || ''}\n\nSeparate source-backed facts from inference and cite source IDs.`,
    },
    ...messages,
  ];
}

export async function* runDefaultAgent(
  { mode = 'query', messages = [], context = {}, conversationId = '' } = {},
  { wipaModel, hermes } = {},
) {
  const target = mode === 'execute' ? hermes : wipaModel;
  if (!target) {
    yield { type: 'status', phase: 'fallback' };
    if (mode === 'execute' && wipaModel) {
      yield* runDefaultAgent({ mode: 'query', messages, context, conversationId }, { wipaModel, hermes: null });
      return;
    }
    yield { type: 'error', message: 'Agent backend unavailable' };
    return;
  }

  if (mode === 'execute') yield { type: 'status', phase: 'delegating' };
  const stream = mode === 'execute'
    ? target.streamChat({ messages: agentMessages(messages, context), conversationId })
    : target({ messages: agentMessages(messages, context), conversationId });

  for await (const event of asAsyncIterable(stream)) {
    if (typeof event === 'string') yield { type: 'delta', text: event };
    else if (event?.type === 'delta') yield event;
    else if (event?.text) yield { type: 'delta', text: event.text };
    else yield event;
  }

  yield { type: 'done' };
}
