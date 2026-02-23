# Meeting Helper

Meeting Helper is a lightweight web app that demonstrates tool-calling patterns for meeting workflows:

- Real-time discussion capture (during active meeting only)
- Auto-generated 5-minute summaries
- Follow-up calendar scheduling
- Non-joined participant notifications
- Auto-generated meeting notes with focus points
- Simulated email delivery to all participants
- End-of-meeting summary storage in a local vector DB
- RAG-style retrieval for meeting questions

## Run

```bash
python3 -m http.server 8000
```

Open: <http://localhost:8000>

## How feature mapping works

The app includes an internal `invokeTool(name, payload)` dispatcher in `app.js` to mimic tool-calling techniques:

- `summarizeFiveMinutes`
- `scheduleCalendarFollowup`
- `notifyNonJoined`
- `generateMeetingNotes`
- `sendEmail`
- `storeInVectorDb`
- `ragRetrieve`

## Notes

- Email/notification integrations are intentionally simulated in the UI (outbox + notifications list).
- Vector DB is in-memory for demo purposes, using simple term-frequency embeddings and cosine similarity.
