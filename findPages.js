const axios = require('axios');
const fs = require('fs');
const csv = require('fast-csv');
const path = require('path');

// Configuration
const config = {
    wikiUrl: 'https://nithyanandapedia.org/api.php',
    username: 'testkailasa',
    password: 'kenyakailasa',
    outputFile: 'wiki_drive_links.csv',
    pagesFile: 'wiki_pages.json',
    processedFile: 'processed_pages.json'
};

async function getLoginToken() {
    try {
        const response = await axios.get(config.wikiUrl, {
            params: { action: 'query', meta: 'tokens', type: 'login', format: 'json' }
        });
        return response.data.query.tokens.logintoken;
    } catch (error) {
        console.error('Error getting login token:', error);
        throw error;
    }
}

async function login(token) {
    try {
        const response = await axios.post(config.wikiUrl, new URLSearchParams({
            action: 'login',
            lgname: config.username,
            lgpassword: config.password,
            lgtoken: token,
            format: 'json'
        }));
        console.log(response.data);
        if (response.data.login.result !== 'Success') throw new Error('Login failed');
        return response.headers['set-cookie'];
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
}

async function getAllPages(cookies) {
    if (fs.existsSync(config.pagesFile)) {
        console.log('Loading pages from existing file');
        return JSON.parse(fs.readFileSync(config.pagesFile, 'utf8'));
    }

    const pages = [];
    let apcontinue = '';
    
    try {
        do {
            const response = await axios.get(config.wikiUrl, {
                params: { action: 'query', list: 'allpages', apcontinue, aplimit: 500, format: 'json' },
                headers: { Cookie: cookies }
            });
            pages.push(...response.data.query.allpages);
            apcontinue = response.data.continue?.apcontinue || '';
            console.log(`Fetched ${pages.length} pages...`);
        } while (apcontinue);
        
        fs.writeFileSync(config.pagesFile, JSON.stringify(pages));
        console.log(`Saved ${pages.length} pages to ${config.pagesFile}`);
        return pages;
    } catch (error) {
        console.error('Error getting pages:', error);
        throw error;
    }
}

async function getPageContent(pageId, cookies) {
    try {
        const response = await axios.get(config.wikiUrl, {
            params: { action: 'query', prop: 'revisions', rvprop: 'content', pageids: pageId, format: 'json' },
            headers: { Cookie: cookies }
        });
        return response.data.query.pages[pageId].revisions[0]['*'];
    } catch (error) {
        console.error('Error getting page content:', error);
        throw error;
    }
}

async function main() {
    try {
        // Login process
        await login();
        const loginToken = await getLoginToken();
        const cookies = await login(loginToken);
        
        // Get or load all pages
        const allPages = await getAllPages(cookies);
        
        // Load processed pages tracker
        let processedPages = {};
        if (fs.existsSync(config.processedFile)) {
            processedPages = JSON.parse(fs.readFileSync(config.processedFile, 'utf8'));
            console.log(`Resuming from ${Object.keys(processedPages).length} processed pages`);
        }

        // Setup CSV stream
        const fileExists = fs.existsSync(config.outputFile);
        const csvStream = csv.format({ headers: !fileExists });
        const writableStream = fs.createWriteStream(config.outputFile, { flags: 'a' });
        csvStream.pipe(writableStream);

        // Process pages
        let processedCount = Object.keys(processedPages).length;
        for (const page of allPages) {
            if (processedPages[page.pageid]) continue;

            const content = await getPageContent(page.pageid, cookies);
            const driveRegex = /https:\/\/drive\.usercontent\.google\.com\/[^\s]+/g;
            const matches = content.match(driveRegex);
            
            if (matches) {
                const pageUrl = `${config.wikiUrl}?title=${encodeURIComponent(page.title)}`;
                matches.forEach(driveLink => {
                    csvStream.write({
                        page_name: page.title,
                        url: pageUrl,
                        drive_link: driveLink
                    });
                });
            }

            processedPages[page.pageid] = true;
            processedCount++;
            console.log(`Processed ${processedCount}/${allPages.length} pages`);

            if (processedCount % 10 === 0) {
                fs.writeFileSync(config.processedFile, JSON.stringify(processedPages));
            }
        }

        fs.writeFileSync(config.processedFile, JSON.stringify(processedPages));
        csvStream.end();
        console.log(`Completed! Results written to ${config.outputFile}`);
        
    } catch (error) {
        console.error('Error in main process:', error);
    }
}

main();

// Function to login to MediaWiki
async function login() {
    try {
      // Step 1: Fetch the login token
      const loginTokenResponse = await api.get("", {
        params: {
          action: "query",
          meta: "tokens",
          type: "login",
          format: "json",
        },
      });
  
      const loginToken = loginTokenResponse.data.query.tokens.logintoken;
  
      // Step 2: Log in using the login token
      const loginResponse = await api.post(
        "",
        new URLSearchParams({
          action: "login",
          lgname: username,
          lgpassword: password,
          lgtoken: loginToken,
          format: "json",
        })
      );
  
      if (loginResponse.data.login.result !== "Success") {
        throw new Error("Login failed: " + loginResponse.data.login.reason);
      }
  
      console.log("Login successful!");
    } catch (error) {
      console.error("Error during login:", error.message);
    }
  }
  