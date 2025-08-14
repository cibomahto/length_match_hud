function loadIndexPage() {
    // Sorting state
    let sortColumn = 'name'; // 'name' or 'diff'
    let sortDirection = 1;   // 1 for ascending, -1 for descending

    async function updateTable(filter = '') {
        try {
            let url = '/net_lengths';
            if (filter) {
                url += '?filter=' + encodeURIComponent(filter);
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            const tbody = document.getElementById('table-body');

            const referenceNet = document.getElementById('reference_net').value;
            const referenceLength = data[referenceNet] ? data[referenceNet].length : null;

            const maxTolerance = parseFloat(document.getElementById('max_tolerance').value);

            // Convert data to array for sorting
            let rowsArr = Object.entries(data).map(([key, value]) => {
                const diff = referenceLength !== null ? (value.length - referenceLength) : null;
                return {
                    name: key,
                    length: value.length,
                    diff: diff,
                    via_count: value.via_count
                };
            });

            // Sort rows
            rowsArr.sort((a, b) => {
                if (sortColumn === 'name') {
                    return a.name.localeCompare(b.name) * sortDirection;
                } else if (sortColumn === 'diff') {
                    // Place nulls at the end
                    if (a.diff === null) return 1;
                    if (b.diff === null) return -1;
                    return (a.diff - b.diff) * sortDirection;
                } else if (sortColumn === 'length') {
                    return (a.length - b.length) * sortDirection;
                } else if (sortColumn === 'via_count') {
                    return (a.via_count - b.via_count) * sortDirection;
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
                rows += `<tr>
                    <td>${row.name}</td>
                    <td>${row.length.toFixed(2)}</td>
                    <td style="${diffBg}">
                        ${row.diff !== null ? row.diff.toFixed(2) : ''}
                    </td>
                    <td>${row.via_count}</td>
                </tr>`;
            });
            tbody.innerHTML = rows;
        } catch (error) {
            console.error('Error fetching table data:', error);
        }
    }

    // Add sorting to table headers
    window.addEventListener('DOMContentLoaded', () => {
        const nameHeader = document.getElementById('th-name');
        const lengthHeader = document.getElementById('th-length');
        const diffHeader = document.getElementById('th-diff');
        const viaHeader = document.getElementById('th-via');

        if (nameHeader && lengthHeader && diffHeader && viaHeader) {
            nameHeader.style.cursor = 'pointer';
            lengthHeader.style.cursor = 'pointer';
            diffHeader.style.cursor = 'pointer';
            viaHeader.style.cursor = 'pointer';

            nameHeader.addEventListener('click', () => {
                if (sortColumn === 'name') {
                    sortDirection *= -1;
                } else {
                    sortColumn = 'name';
                    sortDirection = 1;
                }
                updateTable(document.getElementById('filter').value);
            });

            lengthHeader.addEventListener('click', () => {
                if (sortColumn === 'length') {
                    sortDirection *= -1;
                } else {
                    sortColumn = 'length';
                    sortDirection = 1;
                }
                updateTable(document.getElementById('filter').value);
            });

            diffHeader.addEventListener('click', () => {
                if (sortColumn === 'diff') {
                    sortDirection *= -1;
                } else {
                    sortColumn = 'diff';
                    sortDirection = 1;
                }
                updateTable(document.getElementById('filter').value);
            });

            viaHeader.addEventListener('click', () => {
                if (sortColumn === 'via_count') {
                    sortDirection *= -1;
                } else {
                    sortColumn = 'via_count';
                    sortDirection = 1;
                }
                updateTable(document.getElementById('filter').value);
            });
        }
    });

    function addRowHoverListeners() {
        const tbody = document.getElementById('table-body');
        // Remove previous listeners by cloning
        const newTbody = tbody.cloneNode(true);
        tbody.parentNode.replaceChild(newTbody, tbody);

        newTbody.addEventListener('mouseover', async function (e) {
            let tr = e.target.closest('tr');
            if (!tr || !newTbody.contains(tr)) return;
            // Highlight row
            tr.style.backgroundColor = '#cce4ff';
            const netName = tr.cells[0]?.textContent;
            if (netName) {
                try {
                    await fetch('/select_net', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ net: netName })
                    });
                } catch (err) {
                    console.error('Error calling /select:', err);
                }
            }
        });

        newTbody.addEventListener('mouseout', function (e) {
            let tr = e.target.closest('tr');
            if (!tr || !newTbody.contains(tr)) return;
            // Remove highlight
            tr.style.backgroundColor = '';
        });
    }

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

            const targetNet = '/iMX6 DDR RAM/DRAM_SDCLK0_P';
            const targetOption = Array.from(select.options).find(opt => opt.value === targetNet);
            if (targetOption) {
                select.value = targetNet;
            }
        } catch (error) {
            console.error('Error populating reference net select:', error);
        }
    }

    // Re-add listeners after table update
    const originalUpdateTable = updateTable;
    updateTable = async function (...args) {
        await originalUpdateTable.apply(this, args);
        addRowHoverListeners();
    };

    // Update table on page load
    window.onload = () => {
        const filterInput = document.getElementById('filter');
        updateTable(filterInput.value);

        // Run updateTable every 5 seconds
        clearInterval(window.updateTableInterval);
        window.updateTableInterval = setInterval(() => {
            const filterValue = document.getElementById('filter').value;
            updateTable(filterValue);
        }, 2000);

        populateReferenceNetSelect();
    };

    // Handle filter form submission
    document.getElementById('filter-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const filterValue = document.getElementById('filter').value;
        updateTable(filterValue);
    });

}