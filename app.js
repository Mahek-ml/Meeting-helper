const state = {
  meetingActive: false,
  participants: [],
  joined: new Set(),
  discussions: [],
  intervalSummaries: [],
  notifications: [],
  calendar: [],
  notes: "",
  outbox: [],
  vectorDb: []
};

const tools = {
  summarizeFiveMinutes: generateFiveMinuteSummaries,
  scheduleCalendarFollowup: scheduleFollowupEvent,
  notifyNonJoined: notifyAbsentParticipants,
  generateMeetingNotes: buildMeetingNotes,
  sendEmail: sendNotesEmail,
  storeInVectorDb: storeSummaryVector,
  ragRetrieve: retrieveWithRag
};

function invokeTool(name, payload) {
  if (!tools[name]) {
    throw new Error(`Tool ${name} is not implemented`);
  }
  return tools[name](payload);
}

const el = {
  startMeeting: document.getElementById("startMeeting"),
  endMeeting: document.getElementById("endMeeting"),
  meetingStatus: document.getElementById("meetingStatus"),
  participantName: document.getElementById("participantName"),
  addParticipant: document.getElementById("addParticipant"),
  participantsList: document.getElementById("participantsList"),
  joinSelect: document.getElementById("joinSelect"),
  markJoined: document.getElementById("markJoined"),
  notifyAbsent: document.getElementById("notifyAbsent"),
  notifications: document.getElementById("notifications"),
  speaker: document.getElementById("speaker"),
  minute: document.getElementById("minute"),
  discussionText: document.getElementById("discussionText"),
  addDiscussion: document.getElementById("addDiscussion"),
  discussionList: document.getElementById("discussionList"),
  intervalSummaries: document.getElementById("intervalSummaries"),
  generateNotes: document.getElementById("generateNotes"),
  meetingNotes: document.getElementById("meetingNotes"),
  mailOutbox: document.getElementById("mailOutbox"),
  followTopic: document.getElementById("followTopic"),
  followDate: document.getElementById("followDate"),
  scheduleFollowup: document.getElementById("scheduleFollowup"),
  calendarList: document.getElementById("calendarList"),
  ragQuery: document.getElementById("ragQuery"),
  runRag: document.getElementById("runRag"),
  ragResult: document.getElementById("ragResult")
};

function addParticipant(name) {
  if (!name) return;
  state.participants.push(name);
  renderParticipants();
}

function renderParticipants() {
  el.participantsList.innerHTML = state.participants
    .map((p) => `<li>${p}${state.joined.has(p) ? " ✅" : ""}</li>`)
    .join("");
  el.joinSelect.innerHTML = state.participants.map((p) => `<option>${p}</option>`).join("");
}

function startMeeting() {
  state.meetingActive = true;
  state.meetingStartedAt = new Date();
  el.meetingStatus.textContent = `Meeting active since ${state.meetingStartedAt.toLocaleTimeString()}`;
  el.startMeeting.disabled = true;
  el.endMeeting.disabled = false;
}

function endMeeting() {
  state.meetingActive = false;
  const summary = createFinalSummary();
  invokeTool("storeInVectorDb", summary);
  el.meetingStatus.textContent = "Meeting ended. Final summary stored in vector DB.";
  el.startMeeting.disabled = false;
  el.endMeeting.disabled = true;
}

function addDiscussionPoint() {
  if (!state.meetingActive) {
    alert("Discussions can only be logged while the meeting is active.");
    return;
  }

  const speaker = el.speaker.value.trim();
  const text = el.discussionText.value.trim();
  const minute = Number(el.minute.value);

  if (!speaker || !text || Number.isNaN(minute)) return;

  state.discussions.push({ speaker, text, minute });
  el.speaker.value = "";
  el.discussionText.value = "";

  el.discussionList.innerHTML = state.discussions
    .map((d) => `<li>[${d.minute}m] <strong>${d.speaker}</strong>: ${d.text}</li>`)
    .join("");

  state.intervalSummaries = invokeTool("summarizeFiveMinutes", state.discussions);
  renderIntervalSummaries();
}

function generateFiveMinuteSummaries(discussions) {
  const buckets = {};
  for (const item of discussions) {
    const key = Math.floor(item.minute / 5) * 5;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(item.text);
  }

  return Object.keys(buckets)
    .sort((a, b) => Number(a) - Number(b))
    .map((startMinute) => {
      const points = buckets[startMinute];
      const trimmed = points.slice(0, 2).join("; ");
      return {
        window: `${startMinute}-${Number(startMinute) + 4}m`,
        summary: `Key updates: ${trimmed}${points.length > 2 ? "; ..." : ""}`
      };
    });
}

function renderIntervalSummaries() {
  el.intervalSummaries.innerHTML = state.intervalSummaries
    .map((s) => `<li><strong>${s.window}</strong> — ${s.summary}</li>`)
    .join("");
}

function notifyAbsentParticipants() {
  const missing = state.participants.filter((p) => !state.joined.has(p));
  state.notifications = missing.map((name) => `Notification sent to ${name}: please join the meeting.`);
  renderNotifications();
  return state.notifications;
}

function renderNotifications() {
  el.notifications.innerHTML = state.notifications.map((n) => `<li>${n}</li>`).join("");
}

function scheduleFollowupEvent({ topic, when }) {
  const entry = { topic, when };
  state.calendar.push(entry);
  renderCalendar();
  return entry;
}

function renderCalendar() {
  el.calendarList.innerHTML = state.calendar
    .map((event) => `<li>${event.topic} — ${new Date(event.when).toLocaleString()}</li>`)
    .join("");
}

function buildMeetingNotes() {
  const allText = state.discussions.map((d) => d.text).join(" ");
  const frequencies = keywordFrequencies(allText);
  const focusPoints = Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);

  const notes = [
    "Meeting Notes",
    "============",
    `Participants: ${state.participants.join(", ") || "N/A"}`,
    `Total discussion points: ${state.discussions.length}`,
    `Main focus points: ${focusPoints.join(", ") || "No dominant themes"}`,
    "",
    "Timeline summaries:",
    ...state.intervalSummaries.map((s) => `- ${s.window}: ${s.summary}`)
  ].join("\n");

  state.notes = notes;
  return notes;
}

function sendNotesEmail({ notes }) {
  const recipients = state.participants;
  for (const user of recipients) {
    state.outbox.push(`Email sent to ${user}: meeting notes delivered.`);
  }
  renderOutbox();
  return { recipients: recipients.length, notesLength: notes.length };
}

function renderOutbox() {
  el.mailOutbox.innerHTML = state.outbox.map((m) => `<li>${m}</li>`).join("");
}

function createFinalSummary() {
  return [
    ...state.intervalSummaries.map((s) => s.summary),
    state.notes
  ].join(" ");
}

function embedding(text) {
  const freq = keywordFrequencies(text);
  const norm = Math.sqrt(Object.values(freq).reduce((acc, n) => acc + n * n, 0)) || 1;
  return { freq, norm, text };
}

function keywordFrequencies(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .reduce((acc, w) => {
      acc[w] = (acc[w] || 0) + 1;
      return acc;
    }, {});
}

function cosine(a, b) {
  let dot = 0;
  for (const [word, count] of Object.entries(a.freq)) {
    dot += count * (b.freq[word] || 0);
  }
  return dot / (a.norm * b.norm);
}

function storeSummaryVector(summaryText) {
  state.vectorDb.push(embedding(summaryText));
}

function retrieveWithRag(question) {
  if (!state.vectorDb.length) return "No stored meeting summaries yet.";

  const questionVec = embedding(question);
  const ranked = state.vectorDb
    .map((entry) => ({ score: cosine(questionVec, entry), text: entry.text }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return `Best answer context (score ${best.score.toFixed(2)}):\n${best.text.slice(0, 600)}`;
}

el.addParticipant.addEventListener("click", () => addParticipant(el.participantName.value.trim()));
el.startMeeting.addEventListener("click", startMeeting);
el.endMeeting.addEventListener("click", endMeeting);
el.markJoined.addEventListener("click", () => {
  const selected = el.joinSelect.value;
  if (selected) state.joined.add(selected);
  renderParticipants();
});
el.notifyAbsent.addEventListener("click", () => invokeTool("notifyNonJoined"));
el.addDiscussion.addEventListener("click", addDiscussionPoint);
el.scheduleFollowup.addEventListener("click", () => {
  const topic = el.followTopic.value.trim();
  const when = el.followDate.value;
  if (!topic || !when) return;
  invokeTool("scheduleCalendarFollowup", { topic, when });
  el.followTopic.value = "";
});
el.generateNotes.addEventListener("click", () => {
  const notes = invokeTool("generateMeetingNotes");
  el.meetingNotes.textContent = notes;
  invokeTool("sendEmail", { notes });
});
el.runRag.addEventListener("click", () => {
  const q = el.ragQuery.value.trim();
  if (!q) return;
  el.ragResult.textContent = invokeTool("ragRetrieve", q);
});
