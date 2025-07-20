// URLs for fetching data from MSCI and SSCI sheets
const msciUrl = 'https://docs.google.com/spreadsheets/d/1B34MYj61oXb4hZ0WmkMG8LoUxOz2igB20eVMEGmLk8I/gviz/tq?tqx=out:csv&sheet=MSCI&range=A2:M50';
const ssciUrl = 'https://docs.google.com/spreadsheets/d/1B34MYj61oXb4hZ0WmkMG8LoUxOz2igB20eVMEGmLk8I/gviz/tq?tqx=out:csv&sheet=SSCI&range=A2:M50';

let chart;
const lastUpdatedEl = document.getElementById('lastUpdated');
const leaderboardContainer = document.getElementById('leaderboard-container');

// --- Register Chart.js Plugins ---
Chart.register(ChartDataLabels);

// --- Animation State ---
let gradientOffset = 0;

// --- Function to create animated gradient ---
function createAnimatedGradient(ctx, chartArea, baseColor, highlightColor, offset) {
    if (!chartArea) {
        return baseColor; // Return base color if chart area is not ready
    }
    const { top, bottom } = chartArea;
    const gradient = ctx.createLinearGradient(0, bottom, 0, top);

    // Animate the highlight position, cycling from -0.5 to 1.5
    const position = (offset % 2) - 0.5;
    const waveWidth = 0.6;

    const startPos = position - waveWidth / 2;
    const endPos = position + waveWidth / 2;

    // Add color stops, clamping the values between 0 and 1 to avoid errors
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(Math.max(0, Math.min(1, startPos)), baseColor);
    gradient.addColorStop(Math.max(0, Math.min(1, position)), highlightColor);
    gradient.addColorStop(Math.max(0, Math.min(1, endPos)), baseColor);
    gradient.addColorStop(1, baseColor);

    return gradient;
}


// --- Animation Loop ---
function animateChart() {
    gradientOffset += 0.008;
    if (chart) {
        chart.update('none'); // Redraw chart without new animation
    }
    requestAnimationFrame(animateChart);
}

// --- Function to generate a leaderboard table ---
function generateLeaderboardTable(title, data) {
  let tableHTML = `<div class="leaderboard"><h3>${title}</h3><table><thead><tr><th>อันดับ</th><th>ชื่อ</th><th>คะแนน</th></tr></thead><tbody>`;
  data.forEach((player, index) => {
    tableHTML += `<tr><td>#${index + 1}</td><td>${player.name}</td><td>${player.score}</td></tr>`;
  });
  tableHTML += `</tbody></table></div>`;
  return tableHTML;
}

// --- Function to process data from Google Sheets ---
function processSheetData(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) return [];
  const cleanCsv = csvText.replace(/"/g, '');
  const rows = cleanCsv.trim().split('\n');

  const processedData = rows.map(row => {
    const columns = row.split(',');
    
    // Check if the row has enough columns to get data from column M (index 12)
    if (columns.length > 12) {
      const name = columns[0];
      const score = parseFloat(columns[12]) || 0;
      return { name: name, score: score };
    } else {
      return null; // Return null for rows that are not valid
    }
  }).filter(item => item && item.name); // Filter out nulls and items without a name

  return processedData.sort((a, b) => b.score - a.score).slice(0, 4);
}

// --- Helper functions for Chart.js callbacks ---
const createTooltipCallback = (men, women) => (context) => {
  const datasetLabel = context.dataset.label || '';
  const score = context.parsed.y;
  const player = datasetLabel.includes('M') ? men[context.dataIndex] : women[context.dataIndex];
  return `${player?.name || ''}: ${score}`;
};

const createDatalabelFormatter = (men, women) => (value, context) => {
  if (value <= 0) return '';
  const datasetLabel = context.dataset.label || '';
  const player = datasetLabel.includes('M') ? men[context.dataIndex] : women[context.dataIndex];
  return player?.name || '';
};

// --- Main function to fetch and update all data ---
async function fetchAndUpdateAll() {
  try {
    const [msciResponse, ssciResponse] = await Promise.all([fetch(msciUrl), fetch(ssciUrl)]);
    if (!msciResponse.ok || !ssciResponse.ok) throw new Error('Network response was not ok.');

    const msciCsvText = await msciResponse.text();
    const ssciCsvText = await ssciResponse.text();

    const top4Men = processSheetData(msciCsvText);
    const top4Women = processSheetData(ssciCsvText);

    leaderboardContainer.innerHTML = generateLeaderboardTable('MOON', top4Men) + generateLeaderboardTable('STAR', top4Women);

    const labels = ['Top 1', 'Top 2', 'Top 3', 'Top 4'];
    const menScores = top4Men.map(p => p.score);
    const womenScores = top4Women.map(p => p.score);

    const maxScore = Math.max(...menScores, ...womenScores);
    const chartCeiling = maxScore > 0 ? maxScore + 20 : 100;

    if (!chart) {
      const ctx = document.getElementById('myChart').getContext('2d');
      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'M',
              data: menScores,
              backgroundColor: (context) => createAnimatedGradient(
                  context.chart.ctx,
                  context.chart.chartArea,
                  'rgba(0, 144, 253, 0.8)',   // Bright Blue for Male
                  'rgba(102, 179, 255, 1)',    // Lighter Bright Blue
                  gradientOffset
              ),
              barPercentage: 0.8,
              borderRadius: 10,
              borderSkipped: false,
            },
            {
              label: 'S',
              data: womenScores,
              backgroundColor: (context) => createAnimatedGradient(
                  context.chart.ctx,
                  context.chart.chartArea,
                  'rgba(255, 20, 147, 0.8)',  // Bright Pink for Female
                  'rgba(255, 105, 180, 1)',   // Lighter Pink
                  gradientOffset + 0.4 // Offset the animation for the second bar
              ),
              barPercentage: 0.8,
              borderRadius: 10,
              borderSkipped: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1000,
            easing: 'easeOutCubic',
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { display: false },
              ticks: { display: false },
              suggestedMax: chartCeiling,
            },
            x: {
              grid: { display: false },
              ticks: {
                color: (context) => {
                  // Create a pulsing effect for the labels
                  const alpha = 0.7 + (Math.sin(gradientOffset * 5) + 1) / 2 * 0.3; // Varies between 0.7 and 1.0
                  return `rgba(255, 215, 0, ${alpha})`; // Pulsing gold color
                },
                padding: 20,
                font: {
                  weight: 'bold',
                  size: 16
                }
              }
            }
          },
          plugins: {
            legend: { labels: { color: '#f0f0f0' } },
            tooltip: { callbacks: { label: createTooltipCallback(top4Men, top4Women) } },
            datalabels: {
              anchor: 'start',
              align: 'start',
              offset: 8,
              color: '#ffffff',
              font: { weight: 'bold', size: 11, family: 'Montserrat' },
              formatter: createDatalabelFormatter(top4Men, top4Women)
            }
          }
        }
      });
      animateChart(); // Start the animation loop
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = menScores;
      chart.data.datasets[1].data = womenScores;
      chart.options.scales.y.suggestedMax = chartCeiling;
      chart.options.plugins.tooltip.callbacks.label = createTooltipCallback(top4Men, top4Women);
      chart.options.plugins.datalabels.formatter = createDatalabelFormatter(top4Men, top4Women);
      // No need to call chart.update() here, the animation loop handles it
    }

   //lastUpdatedEl.textContent = 'อัปเดตล่าสุด: ' + new Date().toLocaleTimeString();

  } catch (error) {
    console.error('Error fetching or processing data:', error);
    lastUpdatedEl.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
  }
}

// --- Initial Load & Interval ---
fetchAndUpdateAll();
setInterval(fetchAndUpdateAll, 15000);