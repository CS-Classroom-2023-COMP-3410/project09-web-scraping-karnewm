const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const URL = 'https://denverpioneers.com/landing/index';

async function scrapeAthletics() {
    try {
        console.log('Fetching DU Athletics page...');
        const { data } = await axios.get(URL);
        const $ = cheerio.load(data);

        const html = typeof data === 'string' ? data : '';

        const regex = /var\s+obj\s*=\s*(\{[^;]*\});/g;
        let scoreboardData = null;
        let m;

        while ((m = regex.exec(html)) !== null) {
            try {
                const parsed = JSON.parse(m[1]);
                if (parsed.type === 'events' && parsed.data && Array.isArray(parsed.data)) {
                    scoreboardData = parsed;
                    break;
                }
            } catch (e) {
            }
        }

        if (!scoreboardData) {
            console.error('Could not find scoreboard events JSON data in the page.');
            process.exit(1);
        }

        const events = [];

        for (const item of scoreboardData.data) {
            const sport = item.sport?.title || '';
            const opponentName = item.opponent?.name || '';
            const dateStr = item.date || '';

            let formattedDate = '';
            if (dateStr) {
                const d = new Date(dateStr);
                formattedDate = d.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            const duTeam = `Denver ${sport}`;

            events.push({
                duTeam: duTeam,
                opponent: opponentName,
                date: formattedDate
            });

            console.log(`  ${duTeam} vs ${opponentName} - ${formattedDate}`);
        }

        console.log(`\nTotal events extracted: ${events.length}`);

        const outputPath = path.join(__dirname, 'results', 'athletic_events.json');
        await fs.ensureDir(path.join(__dirname, 'results'));
        await fs.writeJSON(outputPath, { events }, { spaces: 4 });
        console.log(`Results saved to ${outputPath}`);

    } catch (error) {
        console.error('Error scraping athletics:', error.message);
        process.exit(1);
    }
}

scrapeAthletics();