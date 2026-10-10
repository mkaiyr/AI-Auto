// Фоновый поток для модели: вычисления идут здесь, поэтому страница не замирает во время загрузки и ответа.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (message: MessageEvent) => handler.onmessage(message)
