# Demo video

`kavach_demo.mp4` (6:00, 1080p30) is rendered from the real app, not mocked up:

- `slides.html`: the story scenes (`#intro`, `#stack`, `#engines`, `#impact`, `#close`)
- `record.mjs`: drives the live console with Playwright and records Chrome screencast
  frames. It adds captions, a cursor and highlight rings, mutes speech synthesis, and
  times every action to the script.
- `assemble.sh`: turns the frames into exact-length clips and joins them with ffmpeg
- `VOICEOVER.txt`: the narration, split into 11 timed clips

```bash
npm start                                    # app on :3000
npm i playwright                             # in a scratch folder
SLIDES=video/slides.html OUT=segments node video/record.mjs all
bash video/assemble.sh segments video/kavach_demo.mp4
```

The briefing source line in the recording shows what a configured `NUGEN_API_KEY`
produces. With no key, the app labels the text as template phrasing.
