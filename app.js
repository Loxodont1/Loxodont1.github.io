  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }

        let tasks = [];
let weights = {
    importance: 0.1,
    effort: 0.4,
    urgency: 0.5
};
let currentFilters = new Set(['all']);
let subtaskInputs = [];
let expandedTasks = new Set();
let editingTaskId = null;
let currentPage = 'tasks';
let pinnedTasks = new Set();

        // Load data from localStorage on startup
        function loadData() {
    const savedTasks = localStorage.getItem('tasks');
    const savedWeights = localStorage.getItem('weights');
    const savedFilters = localStorage.getItem('currentFilters');
    const savedPinnedTasks = localStorage.getItem('pinnedTasks');
    
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    if (savedWeights) {
        weights = JSON.parse(savedWeights);
        // Update settings modal with saved weights
        document.getElementById('importanceWeight').value = weights.importance;
        document.getElementById('effortWeight').value = weights.effort;
        document.getElementById('urgencyWeight').value = weights.urgency;
        document.getElementById('importanceWeightValue').textContent = weights.importance.toFixed(1);
        document.getElementById('effortWeightValue').textContent = weights.effort.toFixed(1);
        document.getElementById('urgencyWeightValue').textContent = weights.urgency.toFixed(1);
        document.getElementById('displayImportanceWeight').textContent = weights.importance.toFixed(1);
        document.getElementById('displayEffortWeight').textContent = weights.effort.toFixed(1);
        document.getElementById('displayUrgencyWeight').textContent = weights.urgency.toFixed(1);
    }
    if (savedFilters) {
    currentFilters = new Set(JSON.parse(savedFilters));
}
    if (savedPinnedTasks) {
        pinnedTasks = new Set(JSON.parse(savedPinnedTasks));
    }
}

        // Save data to localStorage
        function saveData() {
            localStorage.setItem('tasks', JSON.stringify(tasks));
            localStorage.setItem('weights', JSON.stringify(weights));
            localStorage.setItem('currentFilters', JSON.stringify([...currentFilters]));
            localStorage.setItem('pinnedTasks', JSON.stringify([...pinnedTasks]));
        }

        // Set minimum date to today
        document.getElementById('deadline').min = new Date().toISOString().split('T')[0];

        function openModal() {
            editingTaskId = null;
            document.getElementById('modalOverlay').classList.add('active');
            document.querySelector('.modal h2').textContent = 'Add New Task';
            document.querySelector('.btn-save').textContent = 'Save Task';
            // Reset sliders to 0
            document.getElementById('importance').value = '0';
            document.getElementById('effort').value = '0';
            document.getElementById('importanceValue').textContent = '0';
            document.getElementById('effortValue').textContent = '0';
        }

        function closeModal() {
            document.getElementById('modalOverlay').classList.remove('active');
            editingTaskId = null;
            // Clear form
            document.getElementById('taskName').value = '';
            document.getElementById('taskNotes').value = '';
            document.getElementById('taskTag').value = '';
            document.getElementById('importance').value = '0';
            document.getElementById('effort').value = '0';
            document.getElementById('importanceValue').textContent = '0';
            document.getElementById('effortValue').textContent = '0';
            document.getElementById('deadline').value = '';
            document.getElementById('disableScore').checked = false;
            // Clear subtasks
            subtaskInputs = [];
            document.getElementById('subtasksList').innerHTML = '<p class="subtask-empty">No subtasks added yet</p>';
            // Reset modal title
            document.querySelector('.modal h2').textContent = 'Add New Task';
            document.querySelector('.btn-save').textContent = 'Save Task';
        }

        function closeModalOnOverlay(event) {
            if (event.target === event.currentTarget) {
                closeModal();
            }
        }

        function updateSliderValue(sliderId) {
            const slider = document.getElementById(sliderId);
            const valueDisplay = document.getElementById(sliderId + 'Value');
            valueDisplay.textContent = slider.value;
        }

        function addSubtaskInput() {
    // Save current values before adding a new one
    const currentValues = subtaskInputs.map(item => {
        const id = typeof item === 'object' ? item.tempId : item;

        const textEl = document.getElementById(`subtask-${id}`);
        const durationEl = document.getElementById(`subtask-duration-${id}`);

        const text = textEl ? textEl.value : (item.text || '');
        const duration = durationEl ? durationEl.value : (item.duration || '');

        return {
            tempId: id,
            id: typeof item === 'object' ? item.id : null,
            text,
            duration,
            completed: item.completed || false
        };
    });

    // Add blank subtask
    currentValues.push({
        tempId: Date.now(),
        id: null,
        text: '',
        duration: '',
        completed: false
    });

    subtaskInputs = currentValues;
    renderSubtaskInputs();
}

        function removeSubtaskInput(id) {
            subtaskInputs = subtaskInputs.filter(item => {
                const itemId = typeof item === 'object' ? item.tempId : item;
                return itemId !== id;
            });
            renderSubtaskInputs();
        }

        function renderSubtaskInputs() {
    const container = document.getElementById('subtasksList');
    
    if (subtaskInputs.length === 0) {
        container.innerHTML = '<p class="subtask-empty">No subtasks added yet</p>';
        return;
    }

    container.innerHTML = subtaskInputs.map(item => {
        const text = typeof item === 'object' ? item.text : '';
        const duration = typeof item === 'object' ? (item.duration || '') : '';
        const id = typeof item === 'object' ? item.tempId : item;

        return `
            <div class="subtask-item" data-id="${id}">
                <span class="drag-handle" style="cursor:move; color:#6c757d; margin-right:8px; font-size:18px;">☰</span>
                <input type="text" id="subtask-${id}" placeholder="Enter subtask..." value="${text}" style="flex:2;">
                <input type="number" id="subtask-duration-${id}" placeholder="min" value="${duration}" style="width:70px; padding:8px; border:2px solid #dee2e6; border-radius:6px; font-size:14px;">
                <button type="button" class="btn-remove-subtask" onclick="removeSubtaskInput(${id})">X</button>
            </div>
        `;
    }).join('');
    
    // Initialize drag-and-drop
    initSubtaskDragDrop();
}

let subtaskSortableInstance = null;

function initSubtaskDragDrop() {
    const container = document.getElementById('subtasksList');
    if (!container || container.children.length === 0) return;
    
    // Destroy existing instance if it exists
    if (subtaskSortableInstance) {
        subtaskSortableInstance.destroy();
    }
    
    subtaskSortableInstance = new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        handle: '.drag-handle',
        onEnd: function(evt) {
            // Save current values before reordering
            const currentValues = subtaskInputs.map(item => {
                const id = typeof item === 'object' ? item.tempId : item;
                const textEl = document.getElementById(`subtask-${id}`);
                const durationEl = document.getElementById(`subtask-duration-${id}`);
                
                const text = textEl ? textEl.value : (item.text || '');
                const duration = durationEl ? durationEl.value : (item.duration || '');
                
                return {
                    tempId: id,
                    id: typeof item === 'object' ? item.id : null,
                    text,
                    duration,
                    completed: item.completed || false
                };
            });
            
            // Reorder based on new positions
            const movedItem = currentValues.splice(evt.oldIndex, 1)[0];
            currentValues.splice(evt.newIndex, 0, movedItem);
            
            subtaskInputs = currentValues;
            renderSubtaskInputs();
        }
    });
}

        function openSettingsModal() {
            document.getElementById('settingsModalOverlay').classList.add('active');
        }

        function closeSettingsModal() {
            document.getElementById('settingsModalOverlay').classList.remove('active');
        }

        function closeSettingsModalOnOverlay(event) {
            if (event.target === event.currentTarget) {
                closeSettingsModal();
            }
        }

        function updateWeightSlider(sliderId) {
            const slider = document.getElementById(sliderId);
            const valueDisplay = document.getElementById(sliderId + 'Value');
            valueDisplay.textContent = parseFloat(slider.value).toFixed(1);
            
            // Update display in formula
            if (sliderId === 'importanceWeight') {
                document.getElementById('displayImportanceWeight').textContent = parseFloat(slider.value).toFixed(1);
            } else if (sliderId === 'effortWeight') {
                document.getElementById('displayEffortWeight').textContent = parseFloat(slider.value).toFixed(1);
            } else if (sliderId === 'urgencyWeight') {
                document.getElementById('displayUrgencyWeight').textContent = parseFloat(slider.value).toFixed(1);
            }
        }

        function saveWeights() {
            weights.importance = parseFloat(document.getElementById('importanceWeight').value);
            weights.effort = parseFloat(document.getElementById('effortWeight').value);
            weights.urgency = parseFloat(document.getElementById('urgencyWeight').value);
            
            saveData(); // Save to localStorage
            closeSettingsModal();
            renderTasks(); // Re-render tasks with new weights
        }

        function toggleFilterDropdown() {
            const dropdown = document.getElementById('filterDropdown');
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) {
                updateFilterDropdown();
            }
        }

        function updateFilterDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    
    // Get all unique tags
    const tags = [...new Set(tasks.map(t => t.tag).filter(tag => tag))];
    
    // Count tasks for each tag
    const tagCounts = {};
    tagCounts['all'] = tasks.length;
    tags.forEach(tag => {
        tagCounts[tag] = tasks.filter(t => t.tag === tag).length;
    });
    
    // Build dropdown HTML
    let html = `
        <div class="filter-option ${currentFilters.has('all') ? 'selected' : ''}" onclick="toggleFilter('all')">
            <span>All Tasks</span>
            <span class="filter-count">${tagCounts['all']}</span>
        </div>
    `;
    
    tags.forEach(tag => {
        html += `
            <div class="filter-option ${currentFilters.has(tag) ? 'selected' : ''}" onclick="toggleFilter('${tag}')">
                <span>${tag}</span>
                <span class="filter-count">${tagCounts[tag]}</span>
            </div>
        `;
    });
    
    dropdown.innerHTML = html;
}

        function toggleFilter(filter) {
    if (filter === 'all') {
        // If "All" is clicked, clear everything and select only "All"
        currentFilters.clear();
        currentFilters.add('all');
    } else {
        // Remove "All" if selecting specific tags
        currentFilters.delete('all');
        
        // Toggle the clicked tag
        if (currentFilters.has(filter)) {
            currentFilters.delete(filter);
        } else {
            currentFilters.add(filter);
        }
        
        // If no filters selected, default back to "All"
        if (currentFilters.size === 0) {
            currentFilters.add('all');
        }
    }
    
    saveData();
    updateFilterDropdown(); // Update the dropdown to show selected state
    
    // Re-render based on current page
    if (currentPage === 'tasks') {
        renderTasks();
    } else if (currentPage === 'focus') {
        renderFocusPage();
    }
}

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('filterDropdown');
            const filterBtn = document.querySelector('.filter-btn');
            
            if (!dropdown.contains(event.target) && !filterBtn.contains(event.target)) {
                dropdown.classList.remove('active');
            }
        });

        function addTask() {
            const name = document.getElementById('taskName').value.trim();
            const notes = document.getElementById('taskNotes').value.trim();
            const tag = document.getElementById('taskTag').value.trim();
            const importance = parseInt(document.getElementById('importance').value);
            const effort = parseInt(document.getElementById('effort').value);
            const deadline = document.getElementById('deadline').value;
            const disableScore = document.getElementById('disableScore').checked;

            if (!name) {
                alert('Please enter a task name');
                return;
            }

            if (!deadline && !disableScore) {
    alert('Please select a deadline (or enable "Disable scoring")');
    return;
            }

            // Collect subtasks
            const subtasks = subtaskInputs
    .map(item => {
        const id = typeof item === 'object' ? item.tempId : item;

        const textInput = document.getElementById(`subtask-${id}`);
        const durationInput = document.getElementById(`subtask-duration-${id}`);

        const text = textInput ? textInput.value.trim() : '';
        const duration = durationInput ? durationInput.value.trim() : '';

        const originalId = typeof item === 'object' ? item.id : null;
        const completed = typeof item === 'object' ? item.completed : false;

        return { text, duration, originalId, completed };
    })
                .filter(st => st.text !== '')
                .map(st => ({
    id: st.originalId || (Date.now() + Math.random()),
    text: st.text,
    duration: st.duration,
    completed: st.completed
}));

            if (editingTaskId) {
                // Update existing task
                const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = {
                        ...tasks[taskIndex],
                        name: name,
                        tag: tag,
                        importance: importance,
                        effort: effort,
                        deadline: deadline,
                        subtasks: subtasks,
                        notes: notes,
                        disableScore: disableScore
                    };
                }
            } else {
                // Create new task
                const task = {
                    id: Date.now(),
                    name: name,
                    tag: tag,
                    importance: importance,
                    effort: effort,
                    deadline: deadline,
                    completed: false,
                    subtasks: subtasks,
                    notes: notes,
    disableScore: disableScore
                };
                tasks.push(task);
            }

            closeModal();
            saveData(); // Save to localStorage
            renderTasks();
        }

        function editTask(id) {
            const task = tasks.find(t => t.id === id);
            if (!task) return;

            editingTaskId = id;

            // Populate form
            document.getElementById('taskName').value = task.name;
            document.getElementById('taskNotes').value = task.notes || '';
            document.getElementById('taskTag').value = task.tag || '';
            document.getElementById('importance').value = task.importance;
            document.getElementById('effort').value = task.effort;
            document.getElementById('importanceValue').textContent = task.importance;
            document.getElementById('effortValue').textContent = task.effort;
            document.getElementById('deadline').value = task.deadline;
            document.getElementById('disableScore').checked = task.disableScore || false;

            // Populate subtasks
            subtaskInputs = task.subtasks.map(st => ({
    tempId: Date.now() + Math.random(),
    id: st.id,
    text: st.text,
    duration: st.duration || '',
    completed: st.completed
}));
            renderSubtaskInputs();

            // Update modal title
            document.querySelector('.modal h2').textContent = 'Edit Task';
            document.querySelector('.btn-save').textContent = 'Update Task';

            // Open modal
            document.getElementById('modalOverlay').classList.add('active');
        }

        function calculateScore(task) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadlineDate = new Date(task.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            
            const daysRemaining = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            
            // Formula using custom weights
            const score = (task.importance * weights.importance) + 
                         (task.effort * weights.effort) + 
                         ((7-daysRemaining / 2) * weights.urgency);
            
            return {
                score: score,
                daysRemaining: daysRemaining
            };
        }

        function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveData();
        
        // Re-render the current page
        if (currentPage === 'tasks') {
            renderTasks();
        } else if (currentPage === 'focus') {
            renderFocusPage();
        }
    }
}

        function toggleTaskExpansion(id) {
    if (expandedTasks.has(id)) {
        expandedTasks.delete(id);
    } else {
        expandedTasks.add(id);
    }
    
    // Re-render the current page
    if (currentPage === 'tasks') {
        renderTasks();
    } else if (currentPage === 'focus') {
        renderFocusPage();
    }
}

        function toggleSubtask(taskId, subtaskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const subtask = task.subtasks.find(st => st.id === subtaskId);
        if (subtask) {
            subtask.completed = !subtask.completed;
            saveData();
            
            // Re-render the current page
            if (currentPage === 'tasks') {
                renderTasks();
            } else if (currentPage === 'focus') {
                renderFocusPage();
            }
        }
    }
}

        function deleteTask(id) {
            tasks = tasks.filter(t => t.id !== id);
            saveData(); // Save to localStorage
            renderTasks();
        }

        function renderTasks() {
            const taskList = document.getElementById('taskList');
            
            // Filter tasks based on current filter
            // Filter tasks based on current filters
let filteredTasks = tasks;
if (!currentFilters.has('all')) {
    filteredTasks = tasks.filter(t => t.tag && currentFilters.has(t.tag));
}

if (filteredTasks.length === 0) {
    const filterList = currentFilters.has('all') 
        ? 'all tags' 
        : [...currentFilters].join(', ');
    const message = currentFilters.has('all') 
        ? 'Click the + button to add your first task!'
        : `No tasks with tags: ${filterList}`;
    taskList.innerHTML = `
        <div class="empty-state">
            <h3>No tasks ${currentFilters.has('all') ? 'yet' : 'found'}</h3>
            <p>${message}</p>
        </div>
    `;
    return;
}

            // Calculate scores for filtered tasks
            const tasksWithScores = filteredTasks.map(task => ({
                ...task,
                ...calculateScore(task)
            }));

            // Sort: incomplete scored tasks first, then incomplete unscored, then completed
const sortedTasks = tasksWithScores.sort((a, b) => {
    // Completed tasks always go last
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    
    // Among incomplete tasks
    if (!a.completed && !b.completed) {
        // Tasks with disabled scores go after scored tasks
        if (a.disableScore && !b.disableScore) return 1;
        if (!a.disableScore && b.disableScore) return -1;
        
        // Both have disabled scores - maintain order
        if (a.disableScore && b.disableScore) return 0;
        
        // Both have scores - sort by score
        return b.score - a.score;
    }
    
    return 0;
});

            taskList.innerHTML = sortedTasks.map(task => {
                const isExpanded = expandedTasks.has(task.id);
                const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                const hasNotes = task.notes && task.notes.trim() !== '';
                const canExpand = hasSubtasks || hasNotes;
                const completedSubtasks = hasSubtasks ? task.subtasks.filter(st => st.completed).length : 0;
                const totalSubtasks = hasSubtasks ? task.subtasks.length : 0;
                const progressPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
                
                let subtasksHtml = '';
                if (hasSubtasks && isExpanded) {
                    subtasksHtml = `
                        <div class="task-subtasks">
                            <div class="subtask-progress">📋 ${completedSubtasks}/${totalSubtasks} completed</div>
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${progressPercentage}%"></div>
                            </div>
                            <div class="task-subtasks-sortable" id="subtasks-${task.id}">
                            ${task.subtasks.map(subtask => `
    <div class="task-subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
        <span class="subtask-drag-handle" style="cursor:move; color:#6c757d; margin-right:8px; font-size:16px;">☰</span>
        <input 
            type="checkbox" 
            ${subtask.completed ? 'checked' : ''}
            onchange="toggleSubtask(${task.id}, ${subtask.id})"
        >
        <span class="task-subtask-text">
            ${subtask.text}
            ${subtask.duration ? `<span style="color:#667eea; font-size:12px;"> (${subtask.duration} min)</span>` : ''}
        </span>
    </div>
`).join('')}
                            </div>
                        </div>
                    `;
                }
                
                // Notes display
                let notesHtml = '';
                if (hasNotes && isExpanded) {
                    notesHtml = `
                        <div style="margin-top:15px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e9ecef;">
                            <div style="font-size:13px; font-weight:600; color:#495057; margin-bottom:8px;">
                                📝 Notes
                            </div>
                            <div style="font-size:14px; color:#212529; white-space:pre-wrap;">${task.notes}</div>
                        </div>
                    `;
                }
                
                // Progress bar visible even when collapsed
                let collapsedProgressBar = '';
                if (hasSubtasks && !isExpanded) {
                    collapsedProgressBar = `
                        <div class="progress-bar-container" style="margin-top: 10px;">
                            <div class="progress-bar-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                    `;
                }
                
                return `
    <div class="task-item ${task.completed ? 'completed' : ''} ${isExpanded ? 'expanded' : ''}">
        <div class="task-header-row">
            ${canExpand ? `<button class="expand-btn" onclick="toggleTaskExpansion(${task.id})">▶</button>` : '<div style="width: 24px;"></div>'}
            <input 
                type="checkbox" 
                class="task-checkbox" 
                ${task.completed ? 'checked' : ''}
                onchange="toggleTask(${task.id})"
            >
            <div class="task-content">
                <div class="task-title">${task.name}</div>
                <div class="task-meta">
                    <span>⏰ ${task.daysRemaining} days </span>
                    <span>💪 Effort: ${task.effort}</span>
                    ${task.tag ? `<span class="task-tag">${task.tag}</span>` : ''}
                    ${hasSubtasks && !isExpanded ? `<span>📋 ${completedSubtasks}/${totalSubtasks}</span>` : ''}
                    ${hasNotes && !isExpanded ? `<span>📝 Note</span>` : ''}
                </div>
                ${collapsedProgressBar}
            </div>
            ${task.disableScore ? '' : `<div class="score-badge">${task.score.toFixed(2)}</div>`}
            <div class="task-actions">
                <button class="pin-btn ${pinnedTasks.has(task.id) ? 'pinned' : ''}" onclick="togglePinTask(${task.id})">
                    ${pinnedTasks.has(task.id) ? '📌' : '📌'}
                </button>
                <button class="btn-edit" onclick="editTask(${task.id})">✎</button>
                <button class="btn-delete" onclick="deleteTask(${task.id})">🗑</button>
            </div>
        </div>
        ${isExpanded ? `
            <div class="task-expandable-content">
                ${subtasksHtml}
                ${notesHtml}
            </div>
        ` : ''}
    </div>
`}).join('');
            
            // Initialize drag-drop for all expanded task subtasks
            sortedTasks.forEach(task => {
                if (expandedTasks.has(task.id) && task.subtasks && task.subtasks.length > 0) {
                    initTaskSubtaskDragDrop(task.id);
                }
            });
        }

        function initTaskSubtaskDragDrop(taskId) {
    const container = document.getElementById(`subtasks-${taskId}`);
    if (!container) return;
    
    new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        handle: '.subtask-drag-handle',
        onEnd: function(evt) {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Reorder subtasks array
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            const movedSubtask = task.subtasks.splice(oldIndex, 1)[0];
            task.subtasks.splice(newIndex, 0, movedSubtask);
            
            saveData();
            
            // Re-render the current page
            if (currentPage === 'tasks') {
                renderTasks();
            } else if (currentPage === 'focus') {
                renderFocusPage();
            }
        }
    });
}

function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }

        function closeSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }

        function openSettingsModalFromSidebar() {
            closeSidebar();
            setTimeout(() => {
                openSettingsModal();
            }, 300);
        }

        function navigateToPage(page) {
    currentPage = page;
    
    // Hide all pages
    document.getElementById('tasksPage').classList.remove('active');
    document.getElementById('focusPage').classList.remove('active');
    document.getElementById('aboutPage').classList.remove('active');
    document.getElementById('transferPage').classList.remove('active');
    document.getElementById('timelinePage').classList.remove('active');
    
    // Show selected page
    if (page === 'tasks') {
        document.getElementById('tasksPage').classList.add('active');
        renderTasks();
    } else if (page === 'focus') {
        document.getElementById('focusPage').classList.add('active');
        renderFocusPage();
    } else if (page === 'about') {
        document.getElementById('aboutPage').classList.add('active');
    } else if (page === 'transfer') {
        document.getElementById('transferPage').classList.add('active');
    } else if (page === 'timeline') {
        document.getElementById('timelinePage').classList.add('active');
        renderTimeline();
    }
    
    closeSidebar();
}

function togglePinTask(id) {
    if (pinnedTasks.has(id)) {
        pinnedTasks.delete(id);
    } else {
        pinnedTasks.add(id);
    }
    saveData();
    
    if (currentPage === 'tasks') {
        renderTasks();
    } else if (currentPage === 'focus') {
        renderFocusPage();
    }
}

        function renderFocusPage() {
            const focusList = document.getElementById('focusList');
            
            const focusedTasks = tasks.filter(t => pinnedTasks.has(t.id));
            
            if (focusedTasks.length === 0) {
                focusList.innerHTML = `
                    <div class="empty-state">
                        <h3>No focused tasks</h3>
                        <p>Go to All Tasks and pin tasks to focus on them!</p>
                    </div>
                `;
                return;
            }
            
            // Calculate scores for focused tasks
            const tasksWithScores = focusedTasks.map(task => ({
                ...task,
                ...calculateScore(task)
            }));
            
            // Sort by completion and score
            const sortedTasks = tasksWithScores.sort((a, b) => {
                if (a.completed && !b.completed) return 1;
                if (!a.completed && b.completed) return -1;
                if (!a.completed && !b.completed) {
                    return b.score - a.score;
                }
                return 0;
            });
            
            focusList.innerHTML = sortedTasks.map(task => {
                const isExpanded = expandedTasks.has(task.id);
                const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                const hasNotes = task.notes && task.notes.trim() !== '';
                const canExpand = hasSubtasks || hasNotes;
                const completedSubtasks = hasSubtasks ? task.subtasks.filter(st => st.completed).length : 0;
                const totalSubtasks = hasSubtasks ? task.subtasks.length : 0;
                const progressPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
                
                let subtasksHtml = '';
                if (hasSubtasks && isExpanded) {
                    subtasksHtml = `
                        <div class="task-subtasks">
                            <div class="subtask-progress">📋 ${completedSubtasks}/${totalSubtasks} completed</div>
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${progressPercentage}%"></div>
                            </div>
                            <div class="task-subtasks-sortable" id="subtasks-${task.id}">
                            ${task.subtasks.map(subtask => `
    <div class="task-subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
        <span class="subtask-drag-handle" style="cursor:move; color:#6c757d; margin-right:8px; font-size:16px;">☰</span>
        <input 
            type="checkbox" 
            ${subtask.completed ? 'checked' : ''}
            onchange="toggleSubtask(${task.id}, ${subtask.id})"
        >
        <span class="task-subtask-text">
            ${subtask.text}
            ${subtask.duration ? `<span style="color:#667eea; font-size:12px;"> (${subtask.duration} min)</span>` : ''}
        </span>
    </div>
`).join('')}
                            </div>
                        </div>
                    `;
                }
                
                let notesHtml = '';
                if (hasNotes && isExpanded) {
                    notesHtml = `
                        <div style="margin-top:15px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e9ecef;">
                            <div style="font-size:13px; font-weight:600; color:#495057; margin-bottom:8px;">
                                📝 Notes
                            </div>
                            <div style="font-size:14px; color:#212529; white-space:pre-wrap;">${task.notes}</div>
                        </div>
                    `;
                }
                
                let collapsedProgressBar = '';
                if (hasSubtasks && !isExpanded) {
                    collapsedProgressBar = `
                        <div class="progress-bar-container" style="margin-top: 10px;">
                            <div class="progress-bar-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                    `;
                }
                
                    return `
        <div class="task-item ${task.completed ? 'completed' : ''} ${isExpanded ? 'expanded' : ''}">
            <div class="task-header-row">
                ${canExpand ? `<button class="expand-btn" onclick="toggleTaskExpansion(${task.id})">▶</button>` : '<div style="width: 24px;"></div>'}
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="toggleTask(${task.id})"
                >
                <div class="task-content">
                    <div class="task-title">${task.name}</div>
                    <div class="task-meta">
                        <span>⏰ ${task.daysRemaining} days </span>
                        <span>💪 Effort: ${task.effort}</span>
                        ${task.tag ? `<span class="task-tag">${task.tag}</span>` : ''}
                        ${hasSubtasks && !isExpanded ? `<span>📋 ${completedSubtasks}/${totalSubtasks}</span>` : ''}
                        ${hasNotes && !isExpanded ? `<span>📝 Note</span>` : ''}
                    </div>
                    ${collapsedProgressBar}
                </div>
                ${task.disableScore ? '' : `<div class="score-badge">${task.score.toFixed(2)}</div>`}
                <div class="task-actions">
                    <button class="pin-btn pinned" onclick="togglePinTask(${task.id})">📌</button>
                    <button class="btn-edit" onclick="editTask(${task.id})">✎</button>
                    <button class="btn-delete" onclick="deleteTask(${task.id})">🗑</button>
                </div>
            </div>
            ${isExpanded ? `
                <div class="task-expandable-content">
                    ${subtasksHtml}
                    ${notesHtml}
                </div>
            ` : ''}
        </div>
    `;
}).join('');
            
            // Initialize drag-drop for subtasks
            sortedTasks.forEach(task => {
                if (expandedTasks.has(task.id) && task.subtasks && task.subtasks.length > 0) {
                    initTaskSubtaskDragDrop(task.id);
                }
            });
        }

        function renderTimeline() {
    const container = document.getElementById('timelineContent');
    
    // Get tasks with deadlines only
    const tasksWithDeadlines = tasks.filter(t => t.deadline && !t.disableScore);
    
    if (tasksWithDeadlines.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <h3>No upcoming tasks</h3>
                <p>Tasks with deadlines will appear here on a timeline</p>
            </div>
        `;
        return;
    }
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0];
    
    // Group tasks by date
    const tasksByDate = {};
    tasksWithDeadlines.forEach(task => {
        const dateKey = task.deadline;
        if (!tasksByDate[dateKey]) {
            tasksByDate[dateKey] = [];
        }
        tasksByDate[dateKey].push(task);
    });
    
    // Get all dates and sort them
    const dates = Object.keys(tasksByDate).sort();
    
    // Generate timeline starting from today
    const startDate = new Date(Math.min(today, new Date(dates[0])));
    const endDate = new Date(Math.max(today, new Date(dates[dates.length - 1])));
    
    // Add buffer
    endDate.setDate(endDate.getDate() + 7);
    
    let html = '';
    let lastMonth = null;
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const monthName = currentDate.toLocaleString('default', { month: 'long' }).toUpperCase();
        const dayNumber = currentDate.getDate();
        const isToday = dateKey === todayKey;
        
        // Show month divider when month changes
        if (lastMonth !== monthName) {
            html += `
                <div class="timeline-month-divider">
                    <div class="timeline-month-label">${monthName}</div>
                    <div class="timeline-month-line"></div>
                </div>
            `;
            lastMonth = monthName;
        }
        
        // Get tasks for this date
        const dayTasks = tasksByDate[dateKey] || [];
        
        // Show all days
        html += `
            <div class="timeline-day">
                <div class="timeline-day-marker"></div>
                <div class="timeline-day-number ${isToday ? 'today' : ''}">${dayNumber}</div>
                <div class="timeline-tasks">
                    ${dayTasks.map(task => `
                        <div class="timeline-task-box">
                            <div class="timeline-task-name">${task.name}</div>
                            ${task.tag ? `<div class="timeline-task-tag">${task.tag}</div>` : ''}
                        </div>
                    `).join('')}
                    ${isToday && dayTasks.length === 0 ? '<span style="color: white; font-style: italic;">No tasks today</span>' : ''}
                </div>
            </div>
        `;
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    container.innerHTML = html;
}

        // QR Code Transfer Functions
function generateQR() {
    try {
        console.log('Starting QR generation...');
        
        // Only export current tasks (make a fresh copy)
        const exportData = {
            tasks: tasks.filter(t => t), // Remove any null/undefined
            weights: weights,
            pinnedTasks: [...pinnedTasks].filter(id => tasks.find(t => t.id === id)), // Only pin IDs that exist
            exportDate: new Date().toISOString()
        };
        
        console.log('Exporting', exportData.tasks.length, 'tasks');
        
        // Show export info
        document.getElementById('exportTaskCount').textContent = exportData.tasks.length;
        document.getElementById('exportInfo').style.display = 'block';
        
        const dataString = JSON.stringify(exportData);
        console.log('Data size:', dataString.length, 'characters');
        
        // Check if data is too large
        if (dataString.length > 2000) {
            alert('Warning: Your data is very large (' + dataString.length + ' characters). Try exporting fewer tasks or removing some notes/subtasks.');
            return;
        }
        
        const container = document.getElementById('qrCanvas');
        
        if (!container) {
            alert('Error: Container element not found!');
            return;
        }
        
        if (typeof qrcode === 'undefined') {
            alert('Error: QRCode library not loaded! Please refresh the page.');
            return;
        }
        
        // Clear previous QR code
        container.innerHTML = '';
        
        // Create QR code with high error correction
        const qr = qrcode(0, 'L'); // Type 0 = auto, 'L' = low error correction for more data capacity
        qr.addData(dataString);
        qr.make();
        
        // Create image with larger size for better scanning
        const cellSize = 4;
        const margin = 4;
        const size = qr.getModuleCount();
        const imgSize = size * cellSize + margin * 2 * cellSize;
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = imgSize;
        canvas.height = imgSize;
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, imgSize, imgSize);
        
        // Draw QR code
        ctx.fillStyle = '#000000';
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        col * cellSize + margin * cellSize,
                        row * cellSize + margin * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
        
        // Convert to image
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.border = '3px solid #dee2e6';
        img.style.borderRadius = '8px';
        img.style.padding = '10px';
        img.style.background = 'white';
        
        container.appendChild(img);
        
        // Store canvas for download
        container.canvas = canvas;
        
        console.log('QR code generated successfully!');
        document.getElementById('qrCodeContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Unexpected error:', error);
        alert('Unexpected error: ' + error.message);
    }
}

function downloadQR() {
    const container = document.getElementById('qrCanvas');
    const canvas = container.canvas;
    
    if (!canvas) {
        alert('Please generate a QR code first!');
        return;
    }
    
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'tasks-export-' + Date.now() + '.png';
    link.href = url;
    link.click();
}

function handleQRUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const status = document.getElementById('importStatus');
    status.className = '';
    status.textContent = '⏳ Reading QR code...';
    
    if (typeof jsQR === 'undefined') {
        status.className = 'error';
        status.textContent = '❌ Error: QR reader library not loaded. Please refresh the page.';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                // Create canvas to read QR code
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Decode QR code
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                
                if (code && code.data) {
                    console.log('QR code data found:', code.data.substring(0, 100) + '...');
                    
                    try {
                        const importedData = JSON.parse(code.data);
                        
                        // Validate imported data
                        if (!importedData.tasks || !Array.isArray(importedData.tasks)) {
                            throw new Error('Invalid data format');
                        }
                        
                        // Replace current data
                        tasks = importedData.tasks;
                        weights = importedData.weights || { importance: 0.1, effort: 0.4, urgency: 0.5 };
                        pinnedTasks = new Set(importedData.pinnedTasks || []);
                        
                        // Save to localStorage
                        saveData();
                        
                        // Show success message
                        status.className = 'success';
                        status.textContent = `✅ Successfully imported ${tasks.length} task${tasks.length !== 1 ? 's' : ''}!`;
                        
                        // Clear status after 5 seconds
                        setTimeout(() => {
                            status.textContent = '';
                            status.className = '';
                        }, 5000);
                        
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                        status.className = 'error';
                        status.textContent = '❌ Error: Invalid QR code data format';
                    }
                } else {
                    console.error('Could not read QR code from image');
                    status.className = 'error';
                    status.textContent = '❌ Error: Could not read QR code. Make sure the image is clear and the QR code is fully visible.';
                }
            } catch (error) {
                console.error('Processing error:', error);
                status.className = 'error';
                status.textContent = '❌ Error processing image: ' + error.message;
            }
        };
        
        img.onerror = function() {
            status.className = 'error';
            status.textContent = '❌ Error loading image file';
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        status.className = 'error';
        status.textContent = '❌ Error reading file';
    };
    
    reader.readAsDataURL(file);
    
    // Clear the file input so the same file can be selected again
    event.target.value = '';
}

// Initial render
window.onload = function() {
    loadData();
    renderTasks();
};