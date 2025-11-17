    import axios from 'axios';
    import fs from 'fs';

    const trackedFile = 'tracked_papers.json';

    // Makes a call to Inspire HEP given a paper ID
    // Takes the response data, parses for desired information, and updates memory accordingly
    export async function fetchAndCompareCitations(paperId) {
        const knownTitlesFile = getKnownTitlesFile(paperId);
        const logFile = getLogFile(paperId);

        // request to build data
        try {
        const response = await axios.get('https://inspirehep.net/api/literature', {
            params: {
            sort: 'mostrecent',
            size: 25,
            page: 1,
            q: `refersto:recid:${paperId}`
            },
            headers: {
            'Accept': 'application/vnd+inspire.record.ui+json'
            }
        });
    
        const items = response.data.hits.hits;
        if (!items.length) {
            console.log(`No citations found for paper ${paperId}.`);
            return;
        }

        // Builds a new knownTitles, either starting from scratch or building upon current file.
        let knownTitles = fs.existsSync(knownTitlesFile)
            ? JSON.parse(fs.readFileSync(knownTitlesFile, 'utf8'))
            : [];
    
        let newCitations = [];

        // Loops through items, which is disected response data
        for (let item of items) {
            let titleObj = item.metadata.titles?.find(t => ["arXiv", "IOP", "APS"].includes(t.source)) || item.metadata.titles?.[0];
            const currentTitle = titleObj?.title || "N/A";
            
            // Checks if the title is new
            if (!knownTitles.includes(currentTitle)) {
                // Builds paper elements from the response data, with error handling for unknown cases
                let abstractObj = item.metadata.abstracts?.find(a => ["arXiv", "IOP", "APS"].includes(a.source)) || item.metadata.abstracts?.[0];
                let source = titleObj?.source || "Unknown";
                let arxivIdObj = item.metadata.external_system_identifiers?.find(id => id.url_name === "ADS Abstract Service");
                let doiObj = item.metadata.dois?.[0];
        
                let identifier = arxivIdObj
                    ? arxivIdObj.url_link.split(':').pop()
                    : doiObj?.value || "N/A";
                
                // Pushes data to new citation object
                newCitations.push({
                    title: currentTitle,
                    abstract: abstractObj?.value || "N/A",
                    source: source,
                    identifier: identifier
                });

                // Saves the title so there will be no future duplicates
                knownTitles.push(currentTitle);
            }
        }
        
        // Default response if no new citations are found
        if (newCitations.length === 0) {
            console.log(`No new citations for paper ${paperId}.`);
            return [];
        // Adds the data from newCitations to the json file for future checks, and returns the newCitations object
        } else {
            console.log(`Found ${newCitations.length} new citation(s) for ${paperId}!`);
            fs.writeFileSync(knownTitlesFile, JSON.stringify(knownTitles, null, 2));
            fs.appendFileSync(logFile, JSON.stringify(newCitations, null, 2) + ",\n");
            return newCitations;
        }
    
        } catch (error) {
        console.error(`Error for paper ${paperId}:`, error.message);
        }
    }

    // Adds a paper to the live citation monitor, saving it to memory
    export async function addPaper(paperId) {
        try {
            const response = await axios.get(`https://inspirehep.net/api/literature/${paperId}`, {
            headers: { 'Accept': 'application/vnd+inspire.record.ui+json' }
            });

            const metadata = response.data.metadata;
            const titleObj = metadata.titles?.[0];
            const title = titleObj ? titleObj.title : "Untitled";
            console.log(title);

            let tracked = [];

            // Checks for an exisiting file before creating
            if (fs.existsSync(trackedFile)) {
                tracked = JSON.parse(fs.readFileSync(trackedFile, 'utf8'));
            }

            // Prevent duplicates
            if (tracked.find(entry => entry.paperId === paperId)) {
                console.log(`Paper ${paperId} already tracked.`);
                return;
            }

            // Adds paper to the file being monitored
            tracked.push({ paperId, title });
            fs.writeFileSync(trackedFile, JSON.stringify(tracked, null, 2));
            console.log(`Paper "${title}" added with ID ${paperId}.`);

        } catch (error) {
            console.error(`Failed to add paper ${paperId}:`, error.message);
            throw error;
        }
    }
    
    // Removes a paper from the citation monitor, deleting it from memory
    export function removePaper(paperId) {
        if (!fs.existsSync(trackedFile)) {
        console.log('No tracked papers file found.');
        return;
        }
    
        let papers = JSON.parse(fs.readFileSync(trackedFile, 'utf8'));
    
        const updated = papers.filter(p => p.paperId !== paperId);
        fs.writeFileSync(trackedFile, JSON.stringify(updated, null, 2));
        console.log(`Removed paper ${paperId}`);
    }

    function getKnownTitlesFile(paperId) {
        return `known_titles_${paperId}.json`;
    }
    
    function getLogFile(paperId) {
        return `new_citations_log_${paperId}.json`;
    }

    export function listTrackedPapers() {
        if (!fs.existsSync(trackedFile)) {
        console.log('No tracked papers found.');
        return [];
        }
        
        //Creates a variable for the JSON file if it exists
        const tracked = JSON.parse(fs.readFileSync(trackedFile, 'utf8'));
    
        if (!Array.isArray(tracked) || tracked.length === 0) {
        console.log('Tracked papers list is empty.');
        return [];
        }
    
        console.log('Tracked Papers:\n');
        let resp = [];
        // Returns the title and paper ID for each entry in the tracked file
        tracked.forEach(entry => {
            resp.push(`${entry.title} (ID: ${entry.paperId})`);
        })
        return resp;
    }

    export function getName(paperId) {
        if (!fs.existsSync(trackedFile)) {
        console.error('Tracked papers file not found.');
        return null;
        }

        const tracked = JSON.parse(fs.readFileSync(trackedFile, 'utf8'));
        // Paper is the corresponding entry to paperId provided
        const paper = tracked.find(entry => entry.paperId === paperId);
        
        if (!paper) {
        console.error(`Paper with ID ${paperId} not found.`);
        return null;
        }
        
        return paper.title;
    }

    // Returns all the tracked papers for monitoring
    export function getTracked() {
        if (!fs.existsSync(trackedFile)) {
            console.error('No tracked papers found.');
            return [];
          }
  
          const tracked = JSON.parse(fs.readFileSync(trackedFile, 'utf8'));
        
          if (!Array.isArray(tracked) || tracked.length === 0) {
            console.log('No papers to monitor.');
            return [];
          }
        return tracked;
    }