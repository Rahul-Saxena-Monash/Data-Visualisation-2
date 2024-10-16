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

    // Global normalization
    // This code performs global normalization across all variables:
    // 1. It iterates through each variable (pH, temperature, salinity, etc.)
    // 2. For each variable, it calculates the mean value across all time points
    // 3. It then creates a new data point for each original data point, including:
    //    - The original date and variable name
    //    - The original value
    //    - The deviation from the mean (used for coloring in the heatmap)
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
    // This code performs independent normalization for each variable:
    // 1. We start with an empty array to store our normalized data
    // 2. For each variable (pH, temperature, salinity, etc.):
    //    a. We calculate the mean (average) value for that variable
    //    b. We calculate the standard deviation, which measures how spread out the values are
    //    c. For each data point, we calculate how many standard deviations it is from the mean
    // 3. This allows us to compare changes in different variables, even if they have different scales
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
        height: { step: 80 }, // each row is 80 pixels
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
                title: null,
                sort: variables,
                axis: {
                    labelExpr: "datum.label == 'pH_T' ? 'pH' : datum.label == 'SST' ? 'Sea Surface Temperature' : datum.label == 'SSS' ? 'Sea Surface Salinity' : datum.label == 'OMEGA_A' ? 'Omega Aragonite' : datum.label == 'OMEGA_C' ? 'Omega Calcite' : datum.label == 'pH_deviation' ? 'pH Deviation' : ''",
                    labelLimit: 150
                }
            },
            tooltip: [
                { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
                { field: 'key', type: 'nominal', title: 'Variable' },
                { field: 'value', type: 'quantitative', title: 'Value', format: ',.4f' },
                { field: 'deviation', type: 'quantitative', title: 'Deviation', format: ',.4f' }
            ]
        },
        config: {
            view: { stroke: null },
            axis: { grid: false }
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
                    range: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']
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
                    range: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']
                }
            }
        }
    };

    return [globalNormalizedChart, independentNormalizedChart];
}

function createPhDeviationChart(oceanData, graticuleData, geoData) {
    // Find the points with the largest and smallest pH deviations
    const deviations = geoData.features.map(feature => feature.properties.pH_deviation);
    const maxDeviation = Math.max(...deviations);
    const minDeviation = Math.min(...deviations);

    return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 400,
        title: 'pH Deviation',
        projection: {
            type: 'conicEqualArea',
            center: [0, -12],
            rotate: [-132.5, 5, 0],
            scale: 550,
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
                            range: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']
                        }
                    },
                    size: { value: 75 },
                    tooltip: [
                        { field: "geometry.coordinates.1", type: "quantitative", title: "Latitude" },
                        { field: "geometry.coordinates.0", type: "quantitative", title: "Longitude" },
                        { field: "properties.pH_deviation", type: "quantitative", title: "pH deviation" }
                    ]
                }
            },
            {
                // Annotation for the largest deviation
                data: { values: geoData.features },
                transform: [
                    {
                        filter: `datum.properties.pH_deviation === ${maxDeviation}`
                    }
                ],
                mark: { type: 'text', dy: -10, fontSize: 10, fontWeight: 'bold', color: '#2c7bb6' },
                encoding: {
                    longitude: {
                        field: 'geometry.coordinates.0',
                        type: 'quantitative'
                    },
                    latitude: {
                        field: 'geometry.coordinates.1',
                        type: 'quantitative'
                    },
                    text: { value: 'Max Deviation' }
                }
            },
            {
                // Annotation for the smallest deviation
                data: { values: geoData.features },
                transform: [
                    {
                        filter: `datum.properties.pH_deviation === ${minDeviation}`
                    }
                ],
                mark: { type: 'text', dy: -10, fontSize: 10, fontWeight: 'bold', color: '#d7191c' },
                encoding: {
                    longitude: {
                        field: 'geometry.coordinates.0',
                        type: 'quantitative'
                    },
                    latitude: {
                        field: 'geometry.coordinates.1',
                        type: 'quantitative'
                    },
                    text: { value: 'Min Deviation' }
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
        layer: [
            {
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
                        title: 'Average pH Deviation',
                        scale: {
                            domain: [-0.1, 0.1]  // Set fixed domain for consistency, as divergiving scale
                        }
                    },
                    color: {
                        field: 'average_pH_deviation',
                        type: 'quantitative',
                        scale: {
                            domain: [-0.1, -0.05, 0, 0.05, 0.1],
                            range: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']
                        },
                        legend: {
                            title: 'pH Deviation',
                            orient: 'bottom',
                            direction: 'horizontal',
                            gradientLength: 300
                        }
                    },
                    tooltip: [
                        { field: 'decade', type: 'ordinal', title: 'Decade' },
                        { field: 'average_pH_deviation', type: 'quantitative', title: 'Average pH Deviation', format: '.4f' }
                    ]
                }
            },
            {
                // Annotation for the 2010s
                mark: { type: 'text', align: 'left', dx: 10, dy: -10, fontSize: 12, color: '#000', lineBreak: '\n' },
                encoding: {
                    y: { field: 'decade', type: 'ordinal', datum: '2010s' },
                    x: { datum: 0.005 },
                    text: { value: 'Nearly 30% increase in acidity\nin 2010s compared to 1870s (using log scale)' }
                }
            }
        ]
    };
}

function createTimeSeriesChart(acidificationData) {
    return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: acidificationData },
        params: [
            {
                name: 'variable',
                value: 'pH_T',
                bind: {
                    input: 'select',
                    options: ['pH_T', 'SST', 'SSS', 'OMEGA_A', 'OMEGA_C', 'pH_deviation'],
                    labels: ['pH', 'Sea Surface Temperature', 'Sea Surface Salinity', 'Omega Aragonite', 'Omega Calcite', 'pH Deviation']
                }
            },
            {
                name: 'brush',
                select: { type: 'interval', encodings: ['x'] }
            }
        ],
        transform: [
            {
                calculate: 'datum[variable]',
                as: 'selectedVariable'
            },
        ],
        vconcat: [
            {
                // Main chart
                height: 300,
                width: 'container',
                transform: [{
                    filter: { param: 'brush' }
                }],
                mark: {
                    type: 'line',
                    strokeWidth: 2,
                },
                encoding: {
                    x: {
                        field: 'date',
                        type: 'temporal',
                        title: 'Date',
                        scale: { domain: { param: 'brush' } }
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
                            title: 'Variable',
                            format: '.2f'
                        }
                    ]
                }
            },
            {
                // Brush view
                height: 60,
                width: 'container',
                mark: "area",
                encoding: {
                    x: {
                        field: 'date',
                        type: 'temporal',
                        title: '',
                        axis: { labels: false, values: [], domain: false, ticks: false }
                    },
                    y: {
                        field: 'selectedVariable',
                        type: 'quantitative',
                        title: '',
                        axis: { labels: false, values: [], domain: false, ticks: false }
                    }
                },
                params: [{
                    name: 'brush',
                    select: { type: 'interval', encodings: ['x'] }
                }]
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