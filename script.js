// URLs for fetching data from MSCI and SSCI sheets
const msciUrl = 'https://docs.google.com/spreadsheets/d/1B34MYj61oXb4hZ0WmkMG8LoUxOz2igB20eVMEGmLk8I/gviz/tq?tqx=out:csv&sheet=MSCI&range=A2:I50';
const ssciUrl = 'https://docs.google.com/spreadsheets/d/1B34MYj61oXb4hZ0WmkMG8LoUxOz2igB20eVMEGmLk8I/gviz/tq?tqx=out:csv&sheet=SSCI&range=A2:I50';

let chart;
const lastUpdatedEl = document.getElementById('lastUpdated');
const leaderboardContainer = document.getElementById('leaderboard-container');

// --- Register Chart.js Plugins ---
Chart.register(ChartDataLabels);

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
    return { name: columns[0], score: parseFloat(columns[8]) || 0 };
  }).filter(item => item.name);
  return processedData.sort((a, b) => b.score - a.score).slice(0, 4);
}

// --- Helper functions for Chart.js callbacks ---
const createTooltipCallback = (men, women) => (context) => {
  const datasetLabel = context.dataset.label || '';
  const score = context.parsed.y;
  const player = datasetLabel.includes('MSCI') ? men[context.dataIndex] : women[context.dataIndex];
  return `${player?.name || ''}: ${score}`;
};

const createDatalabelFormatter = (men, women) => (value, context) => {
  if (value <= 0) return '';
  const datasetLabel = context.dataset.label || '';
  const player = datasetLabel.includes('MSCI') ? men[context.dataIndex] : women[context.dataIndex];
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

    leaderboardContainer.innerHTML = generateLeaderboardTable('MSCI', top4Men) + generateLeaderboardTable('SSCI', top4Women);

    const labels = ['อันดับ 1', 'อันดับ 2', 'อันดับ 3', 'อันดับ 4'];
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
              label: 'MSCI',
              data: menScores,
              backgroundColor: 'rgba(255, 99, 132, 0.8)',
              borderRadius: 10,
              borderSkipped: false,
            },
            {
              label: 'SSCI',
              data: womenScores,
              backgroundColor: 'rgba(255, 182, 193, 0.8)',
              borderRadius: 10,
              borderSkipped: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // Add Bar Animation
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
              ticks: { color: '#f0f0f0', padding: 20 }
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
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = menScores;
      chart.data.datasets[1].data = womenScores;
      chart.options.scales.y.suggestedMax = chartCeiling;
      chart.options.plugins.tooltip.callbacks.label = createTooltipCallback(top4Men, top4Women);
      chart.options.plugins.datalabels.formatter = createDatalabelFormatter(top4Men, top4Women);
      chart.update();
    }

    lastUpdatedEl.textContent = 'อัปเดตล่าสุด: ' + new Date().toLocaleTimeString();

  } catch (error) {
    console.error('Error fetching or processing data:', error);
    lastUpdatedEl.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
  }
}

// --- Initial Load & Interval ---
fetchAndUpdateAll();
setInterval(fetchAndUpdateAll, 15000);