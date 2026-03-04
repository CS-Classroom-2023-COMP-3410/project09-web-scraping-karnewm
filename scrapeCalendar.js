const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const BASE_URL = 'https://www.du.edu';
const CALENDAR_URL = `${BASE_URL}/calendar`;

async function scrapeCalendar() {
    try {
        const allEvents = [];
        const seenUrls = new Set();
        for (let month = 0; month < 12; month++) {
            const startDate = new Date(2025, month, 1);
            const endDate = new Date(2025, month + 1, 0); 

            const startStr = formatDate(startDate);
            const endStr = formatDate(endDate);

            console.log(`Fetching events for ${startStr} to ${endStr}...`);

            const url = `${CALENDAR_URL}?start_date=${startStr}&end_date=${endStr}`;

            try {
                const { data } = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Karima"s HP'
                    }
                });

                const $ = cheerio.load(data);

                $('.events-listing__item').each((i, el) => {
                    const card = $(el).find('a.event-card');
                    if (!card.length) return;

                    const href = card.attr('href') || '';
                    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

                    const paragraphs = card.find('p');
                    const title = card.find('h3').text().trim();
                    const dateText = paragraphs.first().text().trim();

                    
                    let time = '';
                    card.find('p').each((j, p) => {
                        const pEl = $(p);
                        if (pEl.find('.icon-du-clock').length) {
                            time = pEl.text().trim();
                        }
                    });

                    if (!title) return;

                    const eventKey = `${fullUrl}|${dateText}`;
                    if (seenUrls.has(eventKey)) return;
                    seenUrls.add(eventKey);

                    allEvents.push({
                        title,
                        date: dateText,
                        time: time || undefined,
                        url: fullUrl
                    });
                });

                console.log(`  Found ${allEvents.length} total unique events so far`);

              
                await sleep(500);
            } catch (err) {
                console.error(`  Error fetching month ${month + 1}: ${err.message}`);
            }
        }

        console.log(`\nFetching descriptions from individual event pages...`);
        console.log(`Total events to process: ${allEvents.length}`);

       
        const BATCH_SIZE = 15;
        for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
            const batch = allEvents.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (event) => {
                try {
                    const { data } = await axios.get(event.url, {
                        headers: {
                            'User-Agent': 'Karima"s HP'
                        },
                        timeout: 5000
                    });

                    const $ = cheerio.load(data);

                    $('script, style').remove();

                    let description = '';
                    const descEl = $('div.description');
                    if (descEl.length) {
                        description = descEl.text().trim();
                    }

                    if (!description) {
                        const fallbackSelectors = [
                            '.field--name-body',
                            '.field--name-field-du-event-description',
                            '.event-detail__description'
                        ];
                        for (const selector of fallbackSelectors) {
                            const el = $(selector);
                            if (el.length && el.text().trim()) {
                                description = el.text().trim();
                                break;
                            }
                        }
                    }

                    if (description) {
                        description = description.replace(/\s+/g, ' ').trim();
                        if (description.length > 500) {
                            description = description.substring(0, 497) + '...';
                        }
                        event.description = description;
                    }
                } catch (err) {
                    
                }
            }));

            process.stdout.write(`  Processed ${Math.min(i + BATCH_SIZE, allEvents.length)}/${allEvents.length} event pages\r`);
            await sleep(100);
        }

        console.log('\n');

        const output = allEvents.map(event => {
            const result = {
                title: event.title,
                date: event.date
            };
            if (event.time) result.time = event.time;
            if (event.description) result.description = event.description;
            return result;
        });

        console.log(`Total 2025 events: ${output.length}`);

        const outputPath = path.join(__dirname, 'results', 'calendar_events.json');
        await fs.ensureDir(path.join(__dirname, 'results'));
        await fs.writeJSON(outputPath, { events: output }, { spaces: 4 });
        console.log(`Results saved to ${outputPath}`);

    } catch (error) {
        console.error('Error scraping calendar:', error.message);
        process.exit(1);
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

scrapeCalendar();