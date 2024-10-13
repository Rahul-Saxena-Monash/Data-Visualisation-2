async function loadAcidificationGeoData() {
    const response = await fetch('./ocean_acidification_geo.json');
    return await response.json();
}

async function loadAcidificationData() {
    const response = await fetch('./ocean_acidification_data.json');
    return await response.json();
}

async function loadOceanData() {
    const response = await fetch('./ne_110m_ocean.json');
    return await response.json();
}

async function loadGraticuleData() {
    const response = await fetch('./ne_110m_graticules_30.json');
    return await response.json();
}

function createHeatmapCharts(data) {
    const variables = ['pH_T', 'SST', 'SSS', 'OMEGA_A', 'OMEGA_C', 'pH_deviation'];
    const variableLabels = {
        'pH_T': 'pH',
        'SST': 'Sea Surface Temperature',
        'SSS': 'Sea Surface Salinity',
        'OMEGA_A': 'Omega Aragonite',
        'OMEGA_C': 'Omega Calcite',
        'pH_deviation': 'pH Deviation'
    };

    // Current approach: global normalization
    let globalNormalizedData = [];
    variables.forEach(variable => {
        let values = data.map(d => d[variable]);
        let mean = values.reduce((a, b) => a + b, 0) / values.length;
        data.forEach(d => {
            globalNormalizedData.push({
                date: d.date,
                key: variable,
                value: d[variable],
                deviation: d[variable] - mean
            });
        });
    });

    // Independent normalization
    let independentNormalizedData = [];
    variables.forEach(variable => {
        let values = data.map(d => d[variable]);
        let mean = values.reduce((a, b) => a + b, 0) / values.length;
        let stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
        data.forEach(d => {
            independentNormalizedData.push({
                date: d.date,
                key: variable,
                value: d[variable],
                deviation: (d[variable] - mean) / stdDev
            });
        });
    });

    const baseChart = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 300,
        mark: 'rect',
        encoding: {
            x: {
                field: 'date',
                type: 'temporal',
                timeUnit: 'yearmonth',
                title: 'Year',
                axis: { format: '%Y', labelAngle: 0 }
            },
            y: {
                field: 'key',
                type: 'nominal',
                title: 'Variable',
                sort: variables,
                axis: {
                    labelExpr: "datum.label == 'pH_T' ? 'pH' : datum.label == 'SST' ? 'Sea Surface Temperature' : datum.label == 'SSS' ? 'Sea Surface Salinity' : datum.label == 'OMEGA_A' ? 'Omega Aragonite' : datum.label == 'OMEGA_C' ? 'Omega Calcite' : datum.label == 'pH_deviation' ? 'pH Deviation' : ''"
                }
            },
            tooltip: [
                { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
                { field: 'key', type: 'nominal', title: 'Variable' },
                { field: 'value', type: 'quantitative', title: 'Value', format: ',.4f' },
                { field: 'deviation', type: 'quantitative', title: 'Deviation', format: ',.4f' }
            ]
        }
    };

    const globalNormalizedChart = {
        ...baseChart,
        title: 'Ocean Acidification Heatmap (Global Normalization)',
        data: { values: globalNormalizedData },
        encoding: {
            ...baseChart.encoding,
            color: {
                field: 'deviation',
                type: 'quantitative',
                title: 'Deviation from Mean',
                scale: {
                    domain: [-0.5, -0.1, 0, 0.1, 0.5],
                    range: ['#d73027', '#fc8d59', '#e0e0e0', '#91bfdb', '#4575b4']
                }
            }
        }
    };

    const independentNormalizedChart = {
        ...baseChart,
        title: 'Ocean Acidification Heatmap (Independent Normalization)',
        data: { values: independentNormalizedData },
        encoding: {
            ...baseChart.encoding,
            color: {
                field: 'deviation',
                type: 'quantitative',
                title: 'Std Dev from Mean',
                scale: {
                    domain: [-3, -1.5, 0, 1.5, 3],
                    range: ['#d73027', '#fc8d59', '#e0e0e0', '#91bfdb', '#4575b4']
                }
            }
        }
    };

    return [globalNormalizedChart, independentNormalizedChart];
}

function createPhDeviationChart(oceanData, graticuleData, geoData) {
    return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 400,
        title: 'pH Deviation',
        projection: {
            type: 'conicEqualArea',
            center: [0, -12],
            rotate: [-132.5, 5, 0],
            scale: 470,
        },
        layer: [
            {
                data: { values: oceanData.features },
                mark: { type: 'geoshape', stroke: 'lightgray', fill: 'false' },
            },
            {
                data: { values: graticuleData.features },
                mark: { type: 'geoshape', stroke: 'lightgray', strokeWidth: 0.5, filled: false },
            },
            {
                data: { values: geoData.features },
                transform: [
                    {
                        filter: "datum.properties.pH_deviation != null"
                    }
                ],
                mark: { type: 'square', opacity: 0.8 },
                encoding: {
                    longitude: {
                        field: 'geometry.coordinates.0',
                        type: 'quantitative'
                    },
                    latitude: {
                        field: 'geometry.coordinates.1',
                        type: 'quantitative'
                    },
                    color: {
                        field: 'properties.pH_deviation',
                        type: 'quantitative',
                        title: 'pH Deviation',
                        scale: {
                            domain: [-0.1, -0.05, 0, 0.05, 0.1],
                            range: ['#d73027', '#fc8d59', '#e0e0e0', '#91bfdb', '#4575b4']
                        }
                    },
                    size: { value: 75 },
                    tooltip: [
                        { field: "geometry.coordinates.1", type: "quantitative", title: "Latitude" },
                        { field: "geometry.coordinates.0", type: "quantitative", title: "Longitude" },
                        { field: "properties.pH_deviation", type: "quantitative", title: "pH deviation" }
                    ]
                }
            }
        ]
    };
}

function createPhDeviationBarChart(acidificationData) {
    return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 400,
        title: 'pH Deviation Over Time',
        data: { values: acidificationData },
        transform: [
            {
                calculate: "floor(year(datum.date) / 10) * 10 + 's'",
                as: 'decade'
            },
            {
                aggregate: [{
                    op: 'mean',
                    field: 'pH_deviation',
                    as: 'average_pH_deviation'
                }],
                groupby: ['decade']
            }
        ],
        mark: 'bar',
        encoding: {
            y: {
                field: 'decade',
                type: 'ordinal',
                title: 'Decade',
                sort: 'ascending'
            },
            x: {
                field: 'average_pH_deviation',
                type: 'quantitative',
                title: 'Average pH Deviation'
            },
            color: {
                field: 'average_pH_deviation',
                type: 'quantitative',
                scale: {
                    domain: [-0.1, -0.05, 0, 0.05, 0.1],
                    range: ['#d73027', '#fc8d59', '#e0e0e0', '#91bfdb', '#4575b4']
                },
                legend: null
            },
            tooltip: [
                { field: 'decade', type: 'ordinal', title: 'Decade' },
                { field: 'average_pH_deviation', type: 'quantitative', title: 'Average pH Deviation', format: '.4f' }
            ]
        }
    };
}

function createTimeSeriesChart(acidificationData) {
    return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 400,
        data: { values: acidificationData },
        params: [
            {
                name: 'variable',
                value: 'pH_T', // Default selected value
                bind: {
                    input: 'select',
                    options: ['pH_T', 'SST', 'SSS', 'OMEGA_A', 'OMEGA_C', 'pH_deviation'],
                    labels: ['pH_T', 'SST', 'SSS', 'Omega Aragonite', 'Omega Calcite', 'pH Deviation']
                }
            }
        ],
        transform: [
            {
                calculate: 'datum[variable]',
                as: 'selectedVariable'
            },
        ],
        layer: [
            {
                // Main chart layer
                mark: {
                    type: 'line',
                    strokeWidth: 2,
                    stroke: {
                        gradient: "linear",
                        stops: [
                            { offset: 0, color: "blue" },
                            { offset: 0.5, color: "gray" },
                            { offset: 1, color: "red" }
                        ],
                        x1: 0,
                        x2: 1,
                        y1: 1,
                        y2: 1
                    }
                },
                encoding: {
                    x: {
                        field: 'date',
                        type: 'temporal',
                        timeUnit: 'yearmonth',
                        title: 'Date'
                    },
                    y: {
                        field: 'selectedVariable',
                        type: 'quantitative',
                        title: { signal: 'variable' },
                        scale: {
                            zero: false,
                            padding: 0.1
                        }
                    },
                    tooltip: [
                        {
                            field: 'date',
                            type: 'temporal',
                            title: 'Date',
                            format: '%b %Y'
                        },
                        {
                            field: 'selectedVariable',
                            type: 'quantitative',
                            title: { signal: 'variable' },
                            format: '.2f'
                        }
                    ]
                }
            },
            {
                // World War I annotation
                mark: {
                    type: 'rect',
                    color: 'lightgray',
                    opacity: 0.2,
                    strokeWidth: 0
                },
                data: { values: [{ start: '1914-07-28', end: '1918-11-11' }] },
                encoding: {
                    x: { field: 'start', type: 'temporal' },
                    x2: { field: 'end', type: 'temporal' }
                }
            },
            {
                // World War I text
                mark: {
                    type: 'text',
                    align: 'center',
                    baseline: 'top',
                    dy: 10,
                    fontSize: 10,
                    fontWeight: 'bold',
                    lineHeight: 12
                },
                data: { values: [{ date: '1916-07-01', text: ['World War I', '(1914-1918)', 'Global industrial', 'disruption'] }] },
                encoding: {
                    x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
                    y: { value: 5 },
                    text: { field: 'text' }
                }
            },
            {
                // Great Depression annotation
                mark: {
                    type: 'rule',
                    color: 'darkgray',
                    strokeWidth: 1,
                    strokeDash: [4, 4]
                },
                data: { values: [{ date: '1929-10-29' }] },
                encoding: {
                    x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' }
                }
            },
            {
                // Great Depression text
                mark: {
                    type: 'text',
                    align: 'left',
                    baseline: 'middle',
                    dx: 5,
                    fontSize: 10,
                    fontWeight: 'bold',
                    lineHeight: 12
                },
                data: { values: [{ date: '1929-10-29', text: ['Great Depression', 'begins (1929)', 'Economic slowdown', 'impacts emissions'] }] },
                encoding: {
                    x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
                    y: { value: 30 },
                    text: { field: 'text' }
                }
            },
            {
                // Post-war boom annotation
                mark: {
                    type: 'rect',
                    color: 'lightgreen',
                    opacity: 0.2,
                    strokeWidth: 0
                },
                data: { values: [{ start: '1945-01-01', end: '1970-01-01' }] },
                encoding: {
                    x: { field: 'start', type: 'temporal' },
                    x2: { field: 'end', type: 'temporal' }
                }
            },
            {
                // Post-war boom text
                mark: {
                    type: 'text',
                    align: 'center',
                    baseline: 'top',
                    dy: 10,
                    fontSize: 10,
                    fontWeight: 'bold',
                    lineHeight: 12
                },
                data: { values: [{ date: '1957-07-01', text: ['Post-war Economic Boom', '(1945-1970)', 'Rapid industrialization', 'and increased emissions'] }] },
                encoding: {
                    x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
                    y: { value: 170 },
                    text: { field: 'text' }
                }
            }
        ]
    };
}

async function createCharts() {
    try {
        showLoader();
        const [geoData, acidificationData, oceanData, graticuleData] = await Promise.all([
            loadAcidificationGeoData(),
            loadAcidificationData(),
            loadOceanData(),
            loadGraticuleData()
        ]);

        const phDeviationChart = createPhDeviationChart(oceanData, graticuleData, geoData);
        const phDeviationBarChart = createPhDeviationBarChart(acidificationData);
        const timeSeriesChart = createTimeSeriesChart(acidificationData);
        const [globalHeatmap, independentHeatmap] = createHeatmapCharts(acidificationData);

        await vegaEmbed('#ph-deviation-chart', phDeviationChart, { actions: false });
        await vegaEmbed('#ph-deviation-bar-chart', phDeviationBarChart, { actions: false });
        await vegaEmbed('#time-series-chart', timeSeriesChart, { actions: false });
        await vegaEmbed('#global-heatmap', globalHeatmap, { actions: false });
        await vegaEmbed('#independent-heatmap', independentHeatmap, { actions: false });

        hideLoader();
    } catch (error) {
        console.error('Error creating charts:', error);
        hideLoader();
    }
}


function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

createCharts();