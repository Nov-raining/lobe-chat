import { ChatResponse } from 'ollama/browser';
import { describe, expect, it, vi } from 'vitest';

import * as uuidModule from '@/utils/uuid';

import { OllamaStream } from './ollama';

describe('OllamaStream', () => {
  describe('should transform Ollama stream to protocol stream', () => {
    it('text', async () => {
      vi.spyOn(uuidModule, 'nanoid').mockReturnValueOnce('1');

      const mockOllamaStream = new ReadableStream<ChatResponse>({
        start(controller) {
          controller.enqueue({ message: { content: 'Hello' }, done: false } as ChatResponse);
          controller.enqueue({ message: { content: ' world!' }, done: false } as ChatResponse);
          controller.enqueue({ message: { content: '' }, done: true } as ChatResponse);

          controller.close();
        },
      });

      const onStartMock = vi.fn();
      const onTextMock = vi.fn();
      const onTokenMock = vi.fn();
      const onCompletionMock = vi.fn();

      const protocolStream = OllamaStream(mockOllamaStream, {
        onStart: onStartMock,
        onText: onTextMock,
        onToken: onTokenMock,
        onCompletion: onCompletionMock,
      });

      const decoder = new TextDecoder();
      const chunks = [];

      // @ts-ignore
      for await (const chunk of protocolStream) {
        chunks.push(decoder.decode(chunk, { stream: true }));
      }

      expect(chunks).toEqual([
        'id: chat_1\n',
        'event: text\n',
        `data: "Hello"\n\n`,
        'id: chat_1\n',
        'event: text\n',
        `data: " world!"\n\n`,
        'id: chat_1\n',
        'event: stop\n',
        `data: "finished"\n\n`,
      ]);

      expect(onStartMock).toHaveBeenCalledTimes(1);
      expect(onTextMock).toHaveBeenNthCalledWith(1, '"Hello"');
      expect(onTextMock).toHaveBeenNthCalledWith(2, '" world!"');
      expect(onTokenMock).toHaveBeenCalledTimes(2);
      expect(onCompletionMock).toHaveBeenCalledTimes(1);
    });

    it('tools use', async () => {
      vi.spyOn(uuidModule, 'nanoid').mockReturnValueOnce('1');

      const mockOllamaStream = new ReadableStream<ChatResponse>({
        start(controller) {
          controller.enqueue({
            model: 'qwen2.5',
            created_at: new Date('2024-12-01T03:34:55.166692Z'),
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  function: {
                    name: 'realtime-weather____fetchCurrentWeather',
                    arguments: { city: '杭州' },
                  },
                },
              ],
            },
            done: false,
          } as unknown as ChatResponse);
          controller.enqueue({
            model: 'qwen2.5',
            created_at: '2024-12-01T03:34:55.2133Z',
            message: { role: 'assistant', content: '' },
            done_reason: 'stop',
            done: true,
            total_duration: 1122415333,
            load_duration: 26178333,
            prompt_eval_count: 221,
            prompt_eval_duration: 507000000,
            eval_count: 26,
            eval_duration: 583000000,
          } as unknown as ChatResponse);

          controller.close();
        },
      });
      const onStartMock = vi.fn();
      const onTextMock = vi.fn();
      const onTokenMock = vi.fn();
      const onToolCall = vi.fn();
      const onCompletionMock = vi.fn();

      const protocolStream = OllamaStream(mockOllamaStream, {
        onStart: onStartMock,
        onText: onTextMock,
        onToken: onTokenMock,
        onCompletion: onCompletionMock,
        onToolCall,
      });

      const decoder = new TextDecoder();
      const chunks = [];

      // @ts-ignore
      for await (const chunk of protocolStream) {
        chunks.push(decoder.decode(chunk, { stream: true }));
      }

      expect(chunks).toEqual(
        [
          'id: chat_1',
          'event: tool_calls',
          `data: [{"function":{"arguments":"{\\"city\\":\\"杭州\\"}","name":"realtime-weather____fetchCurrentWeather"},"id":"realtime-weather____fetchCurrentWeather_0","index":0,"type":"function"}]\n`,
          'id: chat_1',
          'event: stop',
          `data: "finished"\n`,
        ].map((i) => `${i}\n`),
      );

      expect(onTextMock).toHaveBeenCalledTimes(0);
      expect(onStartMock).toHaveBeenCalledTimes(1);
      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(onTokenMock).toHaveBeenCalledTimes(0);
      expect(onCompletionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle empty stream', async () => {
    const mockOllamaStream = new ReadableStream<ChatResponse>({
      start(controller) {
        controller.close();
      },
    });

    const protocolStream = OllamaStream(mockOllamaStream);

    const decoder = new TextDecoder();
    const chunks = [];

    // @ts-ignore
    for await (const chunk of protocolStream) {
      chunks.push(decoder.decode(chunk, { stream: true }));
    }

    expect(chunks).toEqual([]);
  });
});