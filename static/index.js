function loadIndexPage() {
    // Sorting state
    let sortColumn = 'name';
    let sortDirection = 1;   // 1 for ascending, -1 for descending

    let selectedNet = null;  // Local variable to store the selected net
    let remoteSelectedNets = [];  // Local variable to store the selected net

    // TODO: Make this editable
    const active_copper_layers = {
        3: { 'name': 'top', 'delay': 5.8 },
        5: { 'name': 'in2', 'delay': 7.2 },
        10: { 'name': 'in7', 'delay': 7.2 },
        34: { 'name': 'bottom', 'delay': 5.8 }
    };

    const via_delay = 7.2 * 1.6048;  //TODO

    async function fetchAndBuildRowsArr(filter) {
        let url = '/net_lengths';
        if (filter) {
            url += '?filter=' + encodeURIComponent(filter);
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        // Convert data to array for sorting
        return Object.entries(data).map(([key, value]) => {
            let totalLayerDelay = 0;
            const layerLengths = {};
            for (const [layerNum, layerInfo] of Object.entries(active_copper_layers)) {
                const layerName = layerInfo.name;
                layerLengths[layerName] = value.layer_lengths?.[layerNum] ?? 0;
                totalLayerDelay += (value.layer_lengths?.[layerNum] ?? 0) * layerInfo.delay;
            }

            return {
                name: key,
                delay: totalLayerDelay + value.vias * via_delay,
                top: layerLengths.top,
                in2: layerLengths.in2,
                in7: layerLengths.in7,
                bottom: layerLengths.bottom,
                vias: value.vias
            };
        });
    }

    // Calculate the delay difference vs the reference net
    function calculateDiffs(rowsArr) {
        const referenceNet = document.getElementById('reference_net').value;
        const referenceRow = rowsArr.find(row => row.name === referenceNet);
        const referenceDelay = referenceRow ? referenceRow.delay : 0;
        rowsArr.forEach(row => {
            row.diff = row.delay - referenceDelay;
        });
    }

    async function updateTable() {
        try {
            clearInterval(window.updateTableInterval);

            const filter = document.getElementById('filter').value;
            let rowsArr = await fetchAndBuildRowsArr(filter);
            calculateDiffs(rowsArr);

            const maxTolerance = parseFloat(document.getElementById('max_tolerance').value);

            const selectedNetsResponse = await fetch('/selected_nets');
            if (!selectedNetsResponse.ok) throw new Error('Failed to fetch selected nets');
            const selectedNetsData = await selectedNetsResponse.json();
            remoteSelectedNets = selectedNetsData.selected_nets;

            const tbody = document.getElementById('table-body');

            // Sort rows
            rowsArr.sort((a, b) => {
                if (sortColumn === 'name') {
                    return a.name.localeCompare(b.name) * sortDirection;
                } else if (sortColumn === 'delay') {
                    return (a.delay - b.delay) * sortDirection;
                } else if (sortColumn === 'diff') {
                    return (a.diff - b.diff) * sortDirection;
                } else if (sortColumn === 'top') {
                    return (a.top - b.top) * sortDirection;
                } else if (sortColumn === 'in2') {
                    return (a.in2 - b.in2) * sortDirection;
                } else if (sortColumn === 'in7') {
                    return (a.in7 - b.in7) * sortDirection;
                } else if (sortColumn === 'bottom') {
                    return (a.bottom - b.bottom) * sortDirection;
                } else if (sortColumn === 'vias') {
                    return (a.vias - b.vias) * sortDirection;
                }
                return 0;
            });

            // Build table rows
            let rows = '';
            rowsArr.forEach(row => {
                let diffBg = '';
                if (row.diff !== null && Math.abs(row.diff) > maxTolerance) {
                    diffBg = row.diff > 0 ? 'color: #d32f2f;' : 'color: orange;';
                }

                let rowBg = '';

                if (selectedNet == null && remoteSelectedNets.includes(row.name)) {
                    rowBg = 'background-color: #ffe082;';
                }

                rows += `<tr style="${rowBg}">
                    <td>${row.name}</td>
                    <td>${row.delay.toFixed(2)}</td>
                    <td style="${diffBg}">${row.diff.toFixed(2)}</td>
                    <td>${row.top.toFixed(2)}</td>
                    <td>${row.in2.toFixed(2)}</td>
                    <td>${row.in7.toFixed(2)}</td>
                    <td>${row.bottom.toFixed(2)}</td>
                    <td>${row.vias}</td>
                </tr>`;
            });
            tbody.innerHTML = rows;

            const statusIndicator = document.getElementById('status-indicator');
            if (statusIndicator) {
                statusIndicator.style.backgroundColor = 'green';
                statusIndicator.textContent = 'READY';
            }
        } catch (error) {
            console.error('Error updating table:', error.message);

            const statusIndicator = document.getElementById('status-indicator');
            if (statusIndicator) {
                statusIndicator.style.backgroundColor = 'red';
                statusIndicator.textContent = 'BUSY';
            }
        } finally {
            window.updateTableInterval = setInterval(() => {
                updateTable();
            }, 2000);
        }
    }

    function addRowHoverListeners() {
        const tbody = document.getElementById('table-body');
        // Remove previous listeners by cloning
        const newTbody = tbody.cloneNode(true);
        tbody.parentNode.replaceChild(newTbody, tbody);

        let isFetching = false;
        let pendingNetName = null;

        async function sendFetch(netName) {
            isFetching = true;
            try {
                await fetch('/selected_nets', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nets: [netName] })
                });
            } catch (err) {
                console.error('Error calling /select:', err);
            } finally {
                isFetching = false;
                if (pendingNetName !== null && pendingNetName !== netName) {
                    const nextNet = pendingNetName;
                    pendingNetName = null;
                    selectedNet = nextNet;
                    sendFetch(nextNet);
                }
            }
        }

        newTbody.addEventListener('mouseover', function (e) {
            let tr = e.target.closest('tr');
            if (!tr || !newTbody.contains(tr)) return;
            // Highlight row
            tr.style.backgroundColor = '#cce4ff';
            const netName = tr.cells[0]?.textContent;
            if (netName && selectedNet !== netName) {
                if (isFetching) {
                    pendingNetName = netName;
                } else {
                    selectedNet = netName;
                    sendFetch(netName);
                }
            }
        });

        newTbody.addEventListener('mouseout', function (e) {
            let tr = e.target.closest('tr');
            if (!tr || !newTbody.contains(tr)) return;
            // Remove highlight
            tr.style.backgroundColor = '';
            selectedNet = null; // Clear selected net on deselection
        });
    }

    // Re-add listeners after table update
    const originalUpdateTable = updateTable;
    updateTable = async function (...args) {
        await originalUpdateTable.apply(this, args);
        addRowHoverListeners();
    };

    async function populateReferenceNetSelect() {
        try {
            const response = await fetch('/get_nets');
            if (!response.ok) throw new Error('Failed to fetch nets');
            const nets = await response.json(); // nets is now a list
            const select = document.getElementById('reference_net');
            select.innerHTML = '';
            nets.forEach(net => {
                const option = document.createElement('option');
                option.value = net;
                option.textContent = net;
                select.appendChild(option);
            });

            const savedReferenceNet = localStorage.getItem('referenceNet');
            if (savedReferenceNet !== null) {
                document.getElementById('reference_net').value = savedReferenceNet;
            }
            // const targetNet = '/iMX6 DDR RAM/DRAM_SDCLK0_P';
            // const targetOption = Array.from(select.options).find(opt => opt.value === targetNet);
            // if (targetOption) {
            //     select.value = targetNet;
            // }
        } catch (error) {
            console.error('Error populating reference net select:', error);
        }
    }

    function addSortingListeners() {
        const headerMap = {
            'th-name': 'name',
            'th-delay': 'delay',
            'th-diff': 'diff',
            'th-top': 'top',
            'th-in2': 'in2',
            'th-in7': 'in7',
            'th-bottom': 'bottom',
            'th-vias': 'vias'
        };

        Object.entries(headerMap).forEach(([headerId, columnKey]) => {
            const header = document.getElementById(headerId);
            if (header) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    if (sortColumn === columnKey) {
                        sortDirection *= -1;
                    } else {
                        sortColumn = columnKey;
                        sortDirection = 1;
                    }
                    updateTable();
                });
            }
        });
    }

    async function selectNoncompliantNets() {
        try {
            const maxTolerance = parseFloat(document.getElementById('max_tolerance').value);
            const tbody = document.getElementById('table-body');
            const noncompliantNets = [];
            for (const tr of tbody.rows) {
                const netName = tr.cells[0]?.textContent;
                const diff = parseFloat(tr.cells[2]?.textContent);
                if (!isNaN(diff) && Math.abs(diff) > maxTolerance) {
                    noncompliantNets.push(netName);
                }
            }
            if (noncompliantNets.length > 0) {
                await fetch('/selected_nets', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nets: noncompliantNets })
                });
                // Highlight the selected rows in the table
                for (const tr of tbody.rows) {
                    const netName = tr.cells[0]?.textContent;
                    if (noncompliantNets.includes(netName)) {
                        tr.style.backgroundColor = '#ffe082';
                    } else {
                        tr.style.backgroundColor = '';
                    }
                }
            }
        } catch (error) {
            console.error('Error selecting noncompliant nets:', error);
        }
    }

    async function deselectAllNets() {
        try {
            await fetch('/selected_nets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nets: [] })
            });
            selectedNet = null;
            updateTable();
        } catch (error) {
            console.error('Error deselecting all nets:', error);
        }
    }

    function addFormListeners() {
        document.getElementById('hud-form').addEventListener('submit', function (e) {
            e.preventDefault();
            updateTable();
        });

        document.getElementById('filter').addEventListener('input', function () {
            const filterValue = document.getElementById('filter').value;
            localStorage.setItem('filterValue', filterValue);
            updateTable();
        });

        document.getElementById('reference_net').addEventListener('change', function () {
            const referenceNet = document.getElementById('reference_net').value;
            localStorage.setItem('referenceNet', referenceNet);
            updateTable();
        });

        document.getElementById('max_tolerance').addEventListener('input', function () {
            const maxTolerance = document.getElementById('max_tolerance').value;
            localStorage.setItem('maxTolerance', maxTolerance);
            updateTable();
        });
    }

    window.addEventListener('DOMContentLoaded', function () {
        const savedFilter = localStorage.getItem('filterValue');
        if (savedFilter !== null) {
            document.getElementById('filter').value = savedFilter;
        }

        const savedMaxTolerance = localStorage.getItem('maxTolerance');
        if (savedMaxTolerance !== null) {
            document.getElementById('max_tolerance').value = savedMaxTolerance;
        }

        addSortingListeners();
        addFormListeners();

        document.getElementById('select-noncompliant').addEventListener('click', selectNoncompliantNets);
        document.getElementById('clear-selection').addEventListener('click', deselectAllNets);

        populateReferenceNetSelect();
        updateTable();
    });
}