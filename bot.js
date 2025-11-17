import dotenv from 'dotenv';
import pkg from '@slack/bolt';
import { fetchAndCompareCitations, addPaper, removePaper, listTrackedPapers, getName, getTracked } from './cite.mjs';

const { App } = pkg;
dotenv.config();

let isMonitoringActive = false;
let monitoringInterval = null;

// Currently "papers-citing-quera" channel on Slack
const ALLOWED_CHANNEL = process.env.ALLOWED_CHANNEL;

// Builds the Slack application with .env file parameters
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Lists all functions of the tool
app.command('/help', async ({command, ack, say}) => {
  await ack();

  // Only continue if the channel is correct
  if (command.channel_id !== ALLOWED_CHANNEL) {
    await say({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  await say(`Welcome to the QuEra Citation Tool, ${command.user_name}\n\nThe feed currently relies on the INSPIRE HEP Database\n` 
    + 'To identify the PAPER_ID, see https://inspirehep.net/literature/2670073 where 2670073 is the PAPER_ID\n\n'
    + 'To get started tracking citations, please use the commands below.\n\n'
    + '*/checkCitations PAPER_ID* - Manually check for the updated citations of any paper, sharing data with the monitor.\n'
    + '*/addPaper PAPER_ID* - Adds a paper to the monitored list of papers\n */removePaper PAPER_ID* - Removes a paper from the monitored list of papers\n'
    + '*/getMonitoring* - Returns the list of currently tracked papers, with their titles and ID\n'
    + '*/startMonitor* - Checks the list of tracked papers for updated citations, once every 24h\n'
    + '*/stopMonitor* - Stops checking the list of updated papers');
});

app.command('/checkcitations', async ({ command, ack, say }) => {
  await ack();

  if (command.channel_id !== ALLOWED_CHANNEL) {
    await say({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  // Parses the paper ID from the command input by the user
  const text = command.text.trim();
  const paperId = text.match(/^\d+$/) ? text : null;

  if (!paperId) {
    await say('Please provide a valid PAPER_ID. Example: `/checkCitations 2670073`')
    return;
  }

  await say('Checking citations...');
  // Calls core functionality from cite.mjs
  const result = await fetchAndCompareCitations(paperId);

  if (!result || result.length === 0) {
    await say('No new citations found.');
  } else {
    let message = `*New "${getName(paperId)}" citations found:*\n`;
    // Builds message with new citations if found
    result.forEach(citation => {
      message += `*${citation.title}*\n_${citation.abstract}_\n(${citation.source}: ${citation.identifier})\n\n`;
    });
    await say(message);
  }
});

// Adds a paper to the monitor
app.command('/addpaper', async ({ command, ack, say }) => {
  await ack();

  if (command.channel_id !== ALLOWED_CHANNEL) {
    await say({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  const text = command.text.trim();
  const paperId = text.match(/^\d+$/) ? text : null;

  await say ('Adding paper...');

  try {
    // Calls addPaper from core functionality
    await addPaper(paperId);
    await say (`Successfully started tracking: ${getName(paperId)}.`);
  } catch {
    await say ('Error adding the paper, please try again.');
  }
});

// Removes paper from the monitor
app.command('/removepaper', async ({ command, ack, say }) => {
  await ack();

  if (command.channel_id !== ALLOWED_CHANNEL) {
    await say({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  const text = command.text.trim();
  const paperId = text.match(/^\d+$/) ? text : null;

  await say ('Removing paper...');
  
  try {
    removePaper(paperId);
    say ('Successfully stopped tracking the paper.');
  } catch {
    await say ('Error removing the paper, please try again.');
  }
});

// Gets the list of currently monitored papers
app.command('/getmonitoring', async ({ command, ack, say }) => {
  await ack();

  if (command.channel_id !== ALLOWED_CHANNEL) {
    await say({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  // Builds a variable with all the tracked papers
  let resp = listTrackedPapers();

  if (resp.length > 0){
    await say('Currently tracking the papers:');
    for (const paper of resp) {
      await say(paper);
    }
  } else {
    await say('No tracked papers found.')
  }
});

//Begins checking the "tracked papers" for new citations once every 24 hours
app.command('/startmonitor', async ({ command, ack, say }) => {
  await ack();

  if (command.channel_id !== ALLOWED_CHANNEL) {
    await say({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  if (isMonitoringActive) {
    await say("Monitoring is already running.");
    return;
  }

  if (!(listTrackedPapers().length > 0)) {
    await say("Unable to begin monitoring. Please add a paper to track before monitoring.");
    return;
  }

  isMonitoringActive = true;
  
  //Function that is iteratively called by the interval
  async function checkAllPapers() {
    let tracked = getTracked();

      say(`📅 Monitoring ${tracked.length} paper(s) for daily citation updates.`);

      for (const { paperId, title } of tracked) {
        // For each tracked paper:
        say(`\n🔍 Checking citations for: "${title}" (ID: ${paperId})`);
        // Get the citations for that paper 
        const result = await fetchAndCompareCitations(paperId);
    
        if (!result || result.length === 0) {
          await say(`No new citations found for ${title}.`);
        } else {
          // Start building a message if citations are found
          let message = `*New "${title}" citations found:*\n\n`;
          result.forEach(citation => {
            // Add the new citation to the message, for each new citation
            message += `*${citation.title}*\n_${citation.abstract}_\n(${citation.source}: ${citation.identifier})\n\n`;
          });
          // Send out the message with new citations
          await say(message);
        }
    
        wait(20);
        // Pause before checking the next tracked paper, preventing rate limits
    }
  }

  // Initial check on startup
  checkAllPapers();
  
  // Schedule next runs every 24 hours (86400000 ms) // 24 * 60 * 60 * 1000
  monitoringInterval = setInterval(checkAllPapers, 86400000); 
  await say("Monitoring started. Updates will occur every 24 hours.");
});

// Stop monitoring the tracked papers
app.command('/stopmonitor', async ({ command, ack, say }) => {
  await ack();

  if (command.channel_id !== ALLOWED_CHANNEL) {
    await respond({
      response_type: 'ephemeral',
      text: "This command can only be used in the designated channel.",
    });
    return;
  }

  // If the monitor is running, clear all enviornment variables and the interval
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    isMonitoringActive = false;
    await say("Monitoring has been stopped.");
  } else {
    await say("The monitor is not currently running.");
  }
});

// Helper to delay X ms before continuing
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Starts the Slack client upon executing the file
(async () => {
  await app.start();
  console.log('Citation App started');

  try {
    const authResult = await app.client.auth.test();
    console.log(`Connected as user: ${authResult.user_id}`);
  } catch (err) {
    console.error('Error authenticating app.client:', err);
  }
})();
