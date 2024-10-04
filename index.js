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
                    scheme: 'blueorange',
                    domainMid: 0,
                    domain: [-2.2, 0, 2.4],
                    clamp: true
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
                    scheme: 'blueorange',
                    domainMid: 0,
                    domain: [-3, 0, 3],
                    clamp: true
                }
            }
        }
    };

    return [globalNormalizedChart, independentNormalizedChart];
}

async function createCharts() {
    try {
        showLoader();
        const geoData = await loadAcidificationGeoData();
        const acidificationData = await loadAcidificationData();
        const oceanData = await loadOceanData();
        const graticuleData = await loadGraticuleData();

        const baseChart = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            width: 'container',
            height: 400
        }

        const phDeviationChart = {
            ...baseChart,
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
        }

        const timeSeriesChart = {
            ...baseChart,
            data: { values: acidificationData },
            mark: 'line',
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
                    mark: 'line',
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
                                format: '%b %d, %Y'
                            },
                            {
                                field: 'selectedVariable',
                                type: 'quantitative',
                                title: 'Value',
                                format: ',.4f'
                            }
                        ]
                    }
                },
                {
                    // World War I annotation
                    mark: {
                        type: 'rect',
                        color: 'lightgray',
                        opacity: 0.3
                    },
                    data: { values: [{ start: '1914-07-28', end: '1918-11-11' }] },
                    encoding: {
                        x: { field: 'start', type: 'temporal' },
                        x2: { field: 'end', type: 'temporal' }
                    }
                },
                {
                    // World War I text
                    mark: { type: 'text', align: 'center', baseline: 'top', dy: 5 },
                    data: { values: [{ date: '1916-07-01', text: 'World War I' }] },
                    encoding: {
                        x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
                        y: { value: 0 },
                        text: { field: 'text' }
                    }
                },
                {
                    // Great Depression annotation
                    mark: {
                        type: 'rule',
                        color: 'gray',
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
                    mark: { type: 'text', align: 'left', baseline: 'middle', dx: 5 },
                    data: { values: [{ date: '1929-10-29', text: 'Great Depression' }] },
                    encoding: {
                        x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
                        y: { value: 20 },
                        text: { field: 'text' }
                    }
                },
                {
                    // Keeling Curve annotation
                    mark: { type: 'rule', color: 'green', },
                    data: { values: [{ date: '1958-03-01' }] },
                    encoding: {
                        x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' }
                    }
                },
                {
                    // Keeling Curve text
                    mark: { type: 'text', align: 'left', baseline: 'middle', dx: 5 },
                    data: { values: [{ date: '1958-03-01', text: 'Keeling Curve measurements begin' }] },
                    encoding: {
                        x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
                        y: { value: 20 },
                        text: { field: 'text' }
                    }
                }
            ]
        };

        const [globalHeatmap, independentHeatmap] = createHeatmapCharts(acidificationData);

        await vegaEmbed('#ph-deviation-chart', phDeviationChart, { actions: false });
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

document.addEventListener('DOMContentLoaded', createCharts);