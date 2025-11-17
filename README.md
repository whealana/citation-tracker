# citation-tracker
The Citation Tracker is a Slack bot that monitors academic papers for new citations using the INSPIRE HEP database. 
It allows users to add papers to a tracking list, fetch recent citations, and receive daily updates — all from a designated Slack channel.

The system has two main components:
1. Core Citation Engine (`cite.mjs`) – Handles citation fetching, comparison, storage, and paper tracking.
2. Slack Bot (`bot.js`) – Exposes commands inside Slack using the Bolt framework, integrating with the citation engine.

Installation

Prerequisites:
- Node.js (>= 18 recommended)
- A Slack workspace and permissions to create a bot app
- An INSPIRE HEP accessible paper ID

Setup:
1. Download the files and open them in your code editor of choice
2. Install dependencies: npm install
3. Create a `.env` file in the root directory (see the example file: env.txt).
4. Start the bot: `node bot.js`

Configuration
The bot requires a `.env` file with Slack credentials:
- SLACK_BOT_TOKEN: Bot user OAuth token from Slack.
- SLACK_SIGNING_SECRET: Used to verify requests from Slack.
- SLACK_APP_TOKEN: Required for Socket Mode.
- ALLOWED_CHANNEL: Slack channel ID for monitoring/commands.

Commands
Available Commands:
/help - Displays available commands and usage instructions.
/checkCitations PAPER_ID - Manually checks for new citations of a given paper.
/addPaper PAPER_ID - Adds a paper to the tracking list for daily monitoring.
/removePaper PAPER_ID - Removes a paper from the tracking list.
/getMonitoring - Lists all currently tracked papers with IDs.
/startMonitor - Starts the daily monitoring loop (every 24h).
/stopMonitor - Stops daily monitoring.

File Reference

cite.mjs:
- fetchAndCompareCitations(paperId) – Queries INSPIRE HEP for new citations and logs updates.
- addPaper(paperId) – Adds a paper to tracked_papers.json.
- removePaper(paperId) – Removes a paper from tracking.
- listTrackedPapers() – Returns a list of tracked papers.
- getName(paperId) – Returns the stored title for a given ID.
- getTracked() – Returns raw tracked paper metadata.

bot.js:
- Implements the Slack bot.
- Wraps core functions from cite.mjs.
- Restricts usage to one channel.
- Runs a monitoring loop with setInterval every 24h.

Example Workflow
1. Add a paper to monitoring:
   /addPaper 2670073
	- This adds a paper to be “tracked” by the monitor
2. Start daily monitoring:
   /startMonitor
   - Bot checks every 24h, posting updates.
3. Manually check at any time:
   /checkCitations 2670073
4. Stop monitoring:
   /stopMonitor
