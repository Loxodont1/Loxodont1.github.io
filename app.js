  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }

        let tasks = [];
        let weights = {
            importance: 0.1,
            effort: 0.4,
            urgency: 0.5
        };
        let currentFilter = 'all';
        let subtaskInputs = [];
        let expandedTasks = new Set();
        let editingTaskId = null;

        // Load data from localStorage on startup
        function loadData() {
            const savedTasks = localStorage.getItem('tasks');
            const savedWeights = localStorage.getItem('weights');
            const savedFilter = localStorage.getItem('currentFilter');
            
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
            if (savedFilter) {
                currentFilter = savedFilter;
            }
        }

        // Save data to localStorage
        function saveData() {
            localStorage.setItem('tasks', JSON.stringify(tasks));
            localStorage.setItem('weights', JSON.stringify(weights));
            localStorage.setItem('currentFilter', currentFilter);
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
                <span style="cursor:move; color:#6c757d; margin-right:8px;">☰</span>
                <input type="text" id="subtask-${id}" placeholder="Enter subtask..." value="${text}" style="flex:2;">
                <input type="number" id="subtask-duration-${id}" placeholder="min" value="${duration}" style="width:70px; padding:8px; border:2px solid #dee2e6; border-radius:6px; font-size:14px;">
                <button type="button" class="btn-remove-subtask" onclick="removeSubtaskInput(${id})">X</button>
            </div>
        `;
    }).join('');
    
    // Initialize drag-and-drop
    initSubtaskDragDrop();
}

function initSubtaskDragDrop() {
    const container = document.getElementById('subtasksList');
    if (!container || container.children.length === 0) return;
    
    new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        handle: '.subtask-item',
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
            
            // Reorder array based on new positions
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            const movedItem = currentValues.splice(oldIndex, 1)[0];
            currentValues.splice(newIndex, 0, movedItem);
            
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
                <div class="filter-option ${currentFilter === 'all' ? 'selected' : ''}" onclick="applyFilter('all')">
                    <span>All Tasks</span>
                    <span class="filter-count">${tagCounts['all']}</span>
                </div>
            `;
            
            tags.forEach(tag => {
                html += `
                    <div class="filter-option ${currentFilter === tag ? 'selected' : ''}" onclick="applyFilter('${tag}')">
                        <span>${tag}</span>
                        <span class="filter-count">${tagCounts[tag]}</span>
                    </div>
                `;
            });
            
            dropdown.innerHTML = html;
        }

        function applyFilter(filter) {
            currentFilter = filter;
            saveData(); // Save filter preference
            document.getElementById('filterDropdown').classList.remove('active');
            renderTasks();
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

            if (!name) {
                alert('Please enter a task name');
                return;
            }

            if (!deadline) {
                alert('Please select a deadline');
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
                        notes: notes
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
                    notes: notes
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
                         ((5-daysRemaining / 2) * weights.urgency);
            
            return {
                score: score,
                daysRemaining: daysRemaining
            };
        }

        function toggleTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                saveData(); // Save to localStorage
                renderTasks();
            }
        }

        function toggleTaskExpansion(id) {
            if (expandedTasks.has(id)) {
                expandedTasks.delete(id);
            } else {
                expandedTasks.add(id);
            }
            renderTasks();
        }

        function toggleSubtask(taskId, subtaskId) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                const subtask = task.subtasks.find(st => st.id === subtaskId);
                if (subtask) {
                    subtask.completed = !subtask.completed;
                    saveData(); // Save to localStorage
                    renderTasks();
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
            let filteredTasks = tasks;
            if (currentFilter !== 'all') {
                filteredTasks = tasks.filter(t => t.tag === currentFilter);
            }
            
            if (filteredTasks.length === 0) {
                const message = currentFilter === 'all' 
                    ? 'Click the + button to add your first task!'
                    : `No tasks with tag "${currentFilter}"`;
                taskList.innerHTML = `
                    <div class="empty-state">
                        <h3>No tasks ${currentFilter === 'all' ? 'yet' : 'found'}</h3>
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

            // Sort: incomplete tasks by score (descending), then completed tasks
            const sortedTasks = tasksWithScores.sort((a, b) => {
                if (a.completed && !b.completed) return 1;
                if (!a.completed && b.completed) return -1;
                if (!a.completed && !b.completed) {
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
        <span style="cursor:move; color:#6c757d; margin-right:8px; font-size:16px;">☰</span>
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
                        ${subtasksHtml}
                        ${notesHtml}
                        
                    </div>
                    <div class="score-badge">${task.score.toFixed(2)}</div>
                    <div class="task-actions">
                        <button class="btn-edit" onclick="editTask(${task.id})">✎</button>
                        <button class="btn-delete" onclick="deleteTask(${task.id})">X</button>
                    </div>
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
        onEnd: function(evt) {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Reorder subtasks array
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            const movedSubtask = task.subtasks.splice(oldIndex, 1)[0];
            task.subtasks.splice(newIndex, 0, movedSubtask);
            
            saveData();
            renderTasks();
        }
    });
}
        // Initial render
        loadData();
        renderTasks();
