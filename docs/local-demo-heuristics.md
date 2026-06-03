# Local Demo Topic Heuristics

TalkTree can run without an API key. In that mode it uses local heuristics so users can test the tree animation and basic topic flow before configuring a model.

Local demo mode is intentionally limited. It does not claim semantic understanding, but it should still make useful distinctions between early main-thread formation, continuation, topic shift, and return.

## Signals Used

The local analyzer now uses:

- Anchor-topic detection for phrases such as "今天讲...", "主题是...", "I want to discuss...", or "topic is...".
- Token overlap across recent segments instead of raw character overlap only.
- Separate overlap checks against the inferred root topic and recent segments.
- Topic-path matching to detect returns to earlier topics.
- Mixed Chinese/English token extraction.

## Behavior

| Situation | Local transition |
| --- | --- |
| User explicitly states a root topic | `continue`, `anchored` |
| New segment overlaps root topic | `continue` or `return` |
| New segment overlaps recent context | `continue` |
| New segment lightly overlaps recent context | `uncertain` |
| New segment has low overlap after setup | `shift` or `branch` |
| New segment matches an earlier topic path item | `return` |

## Example

```text
今天讲 AI 视频工具怎么帮助创作者
先说脚本生成和分镜设计
然后是透明 overlay 在剪辑软件里的用法
回到 AI 视频工具本身，关键是减少重复劳动
```

Expected local behavior:

- The first segment establishes an anchored root topic.
- The second and third segments extend or branch under creator workflow.
- The fourth segment is treated as a return toward the root topic.

## Limitations

- It cannot infer deep semantic similarity without a model.
- Very short segments can still be uncertain.
- CJK tokenization is lightweight and uses short phrase windows.
- Provider-backed analysis should be used when semantic accuracy matters.

These heuristics are designed to keep no-key demo behavior useful and privacy-preserving.
