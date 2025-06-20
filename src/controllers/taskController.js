const { Task, TASK_STATUS, TASK_PRIORITY } = require("../models/taskModel");
const { Project } = require("../models/projectModel")
const { User, ROLES } = require("../models/userModel");

//cretae new task
const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            projectId,
            assignedTo,
            priority,
            dueDate

        } = req.body

        //check if project exists
        const project = await Project.findById(projectId);
        if(!project) {
            return res.status(404).json({ message:'Project' });
        }

        // access control - only team members, coordinator, creator or admin can create tasks
        const isTeamMember = project.isTeamMember(req.user.id);
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isCreator = project.createdBy.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if (!(isTeamMember || isCoordinator || isCreator || isAdmin)) {
            return res.status(403).json({ 
                message: 'Access denied - you must be a project team member to create tasks' 
            });
        }

        //check if assigned user exists and is a team member
        const assignedUser = await User.findById(assignedTo);
        if(!assignedUser) {
            return res.status(404).json({ message: "Assigned user not found" });
        }

        if(!project.isTeamMember(assignedTo) && assignedTo !== project.coordinator.toString()) {
            return res.status(400).json({ 
                message: "Assigned user must be a team memeber or coordinator" 
            });
        }

        //create new task
        const task = new Task({
            title,
            description,
            project: projectId,
            assignedTo,
            assignedBy: req.user.id,
            createdBy: req.user.id,
            priority:priority || TASK_PRIORITY.MEDIUM,
            dueDate
        });

        //save task
        await task.save();

        res.status(201).json({
            message: 'Task created successfully',
            task
        })
    } catch (error) {
        console.error("Task creation error: ",error);
        res.status(500).json({ message: "Server error during task creation"});
    }
};


//get all tasks (with filtering options)
const getTasks = async (req, res) => {
    try {
        const {
            project,
            status,
            priority,
            assignedTo,
            createdBy,
            dueBefore,
            dueAfter,
            isOverdue
        } = req.query;

        //build filter object
        const filter = {};

        //apply filters
        if (project) filter.project = project;
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (createdBy) filter.createdBy = createdBy;

        //date filter
        if(isOverdue == 'true') {
            filter.dueDate = { $lt: new Date() };
            filter.status = { $ne: TASK_STATUS.COMPLETED };
            filter.completedAt = null;
        }

        //role - based access control
        //if not admin or coordinator, only show tasks for their projects or assigned to them
        if(![ROLES.ADMIN, ROLES.COORDINATOR].includes(req.user.role))
        {
            const userProjects = await Project.find({
                $or: [
                    { coordinator: req.user.id },
                    { 'teamMembers.user': req.user.id },
                    { createdBy: req.user.id }
                ]
            }).select('_id');

            const projectIds = userProjects.map(p => p._id);

            filter.$or = [
                { project: { $in: projectIds }},
                { assignedTo: req.user.id },
                { createdBy: req.user.id }
            ];
        }

        // Query with populated fields
        const tasks = await Task.find(filter)
            .populate('project', 'title')
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('comments.author', 'name email')
            .populate('approvals.approver', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            count: tasks.length,
            tasks
        });     
    } catch(error) {
        console.error('get tasks error:', error);
        res.status(500).json({ message:"Server error while fetching tasks"});
    }
};


const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('project', 'title coordinator teamMembers')
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('comments.author', 'name email')
            .populate('approvals.approver', 'name email')
            .populate('revisions.submittedBy', 'name email');
        
        if(!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Access control - only project team members, coordinator, task assignee, 
        // task creator or admin can view task details
        const project = await Project.findById(task.project._id);
        
        const isTeamMember = project.isTeamMember(req.user.id);
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAssignee = task.assignedTo._id.toString() === req.user.id.toString();
        const isCreator = task.createdBy._id.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if (!(isTeamMember || isCoordinator || isAssignee || isCreator || isAdmin)) {
        return res.status(403).json({ 
            message: 'Access denied - you are not authorized to view this task' 
        });
        }

        res.json({ task });        
    } catch (error) {
        console.error("get task error:", error);
        res.status(500).json({ message: "Server error while fetching task" });
    }
};


const updateTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            assignedTo,
            dueDate
        } = req.body;

        //find the task
        const task = await Task.findBy.Id(req.params.id);

        if(!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Get the associated project
        const project = await Project.findById(task.project);

        // Access control - only task creator, assignee, project coordinator or admin can update
        const isCreator = task.createdBy.toString() === req.user.id.toString();
        const isAssignee = task.assignedTo.toString() === req.user.id.toString();
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if (!(isCreator || isAssignee || isCoordinator || isAdmin)) {
        return res.status(403).json({ 
            message: 'Access denied - you are not authorized to update this task' 
        });
        }

        // If changing assignee, validate
        if (assignedTo && assignedTo !== task.assignedTo.toString()) {
        const assignedUser = await User.findById(assignedTo);
        
        if (!assignedUser) {
            return res.status(400).json({ message: 'Assigned user not found' });
        }

        // Check if new assignee is a team member or coordinator
        if (!project.isTeamMember(assignedTo) && assignedTo !== project.coordinator.toString()) {
            return res.status(400).json({ 
            message: 'Assigned user must be a team member or coordinator' 
            });
        }
        }

        // Update task fields
        if (title) task.title = title;
        if (description) task.description = description;
        if (priority) task.priority = priority;
        if (dueDate) task.dueDate = dueDate;
        
        // Special handling for status changes
        if (status && task.status !== status) {
        task.status = status;
        
        // Set completion details if status is changed to completed
        if (status === TASK_STATUS.COMPLETED) {
            task.completedAt = Date.now();
            task.completedBy = req.user.id;
        } else if (task.completedAt) {
            // Clear completion details if task is being un-completed
            task.completedAt = undefined;
            task.completedBy = undefined;
        }
        }
        
        // Special handling for assignee changes
        if (assignedTo && assignedTo !== task.assignedTo.toString()) {
        task.assignedTo = assignedTo;
        
        // Add comment about reassignment
        const assignedUser = await User.findById(assignedTo).select('name');
        task.comments.push({
            text: `Task reassigned to ${assignedUser.name} by ${req.user.name}`,
            author: req.user.id,
            createdAt: Date.now()
        });
        }

        // Save updated task
        await task.save();

        // Populate references for response
        const updatedTask = await Task.findById(req.params.id)
        .populate('project', 'title')
        .populate('assignedTo', 'name email')
        .populate('assignedBy', 'name email')
        .populate('createdBy', 'name email')
        .populate('comments.author', 'name email');

        res.json({
        message: 'Task updated successfully',
        task: updatedTask
        });
    } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error during task update' });
  }
};


//delete task
const deleteTask = async (req,res) => {
    try {
        
        //find the task
        const task = await Task.findBy.Id(req.params.id);
        if(!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const project = await Project.findById(task.project);

        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isCreator = task.createdBy.toString() === req.user.id.toString();
        const isAdmin = req.user.role == ROLES.ADMIN;
        
        if(!(isCreator || isAdmin || isCoordinator)) {
            return res.status(403).json({
                message: "Access denied - only project creator or admin can delete the project"
            });
        }

        //delete task
        await task.remove();
        res.json({message: "Task Deleted Successfully"});

    } catch(error) {
        console.error("Delete Task Error:",error);
        res.status(500).json({message: "Server Error during task deletion"});
    }
};


//add comment to task
const addComment = async (req,res) => {
    try {
        const { text } = req.body;

        const task = await Task.findById(req.params.id);

        if(!task) {
            return res.status(404).json({ message: 'Task not found'});
        }

        const project = await Project.findById(task.project);

        const isTeamMember = project.isTeamMember(req.user.id);
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if(!(isTeamMember || isCoordinator || isAdmin))
        {
            return res.status(403).json({
                message: 'Acess denied - you must be a team mebers to add comments'
            });
        }

        //add comment
        task.comments.push({
            text,
            author: req.user.id,
            createdAt: Date.now()
        });

        await task.save();

        const updatedTask = await Task.findById(req.params.id)
            .populate('comments.author', 'name email');

        const addedComment = updatedTask.comments[updatedTask.comments.length-1];

        res.json({
            message: 'Comment added successfully',
            comment : addedComment
        });
    } catch(error) {
        console.error('Add comment error:',error);
        res.status(500).json({ message: 'Server error while adding comment' });
    }
}

//submitforapproval
const submitForApproval = async (req,res) => {
    try {
        const { approverID } = req.body;

        //find task
        const task = await Task.findById(req.params.id);
        if(!task) {
            return res.status(404).json({ message: 'Task not found'});
        }

        if(task.assignedTo.toString() != req.user.id.toString()) {
            return res.status(403).json({
                message: 'Acess denied - only task assignee can submit for approval'
            });
        }

        //check if task is already under review
        if( task.status === TASK_STATUS.UNDER_REVIEW)
        {
            return res.status(400).json({ message: 'task is already under review' });
        }

        //validate approver
        const project = await Project.findById(task.project);

        const finalApproverId = approverId || project.coordinator;

        const approver = await User.findById(finalApproverId);
        if (!approver) {
        return res.status(404).json({ message: 'Approver not found' });
        }

        //approver must be a coordinator or higher role
        if(!approver.hasPermission(ROLES.JUNIOR_CORE)) {
            return res.status(400).json({
                message: 'Approver must has at least junior core role'
            });
        }

        //update task status and add approval request
        task.status = TASK_STATUS.UNDER_REVIEW;
        task.approvals.push({
            status: 'pending',
            approver: finalApproverId,
            updatedAt: Date.now()
        });


        //add comments
        task.comments.push({
            text: `Tasksubmitted for approval by ${req.user.name}`,
            author: req.user.id,
            createdAt:Date.now()
        });


        await task.save();

        res.json({
            message: 'Task submitted for approval successfully',
            task
        });

    } catch(error){
        console.error('Submitted for approval error:', error);
        res.status(500).json({ message: 'server erro during submission  for approval' });
    }
};


//approve or reject a task
const processTaskApproval = async (req,res) => {
    try{
        const { status, comments } = req.body;

        //validate status
        if(!['approved','rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be either approved or rejected' });
        }

        //find task
        const task = await Task.findById(req.params.id);

        if(!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        //check if task is under review
        if(task.status !== TASK_STATUS.UNDER_REVIEW) {
            return res.status(400).json({ message: 'Task is not currently under review' });
        }

        //find pending approval where current user is the approver
        const pendingApprovalIndex = task.approvals.findIndex(
            approval => approval.status === 'pending' &&
                    approval.status === 'pending' &&
                    approval.approver.toString() === req.user.id.toString()
        );

        if(pendingApprovalIndex === -1) {
            return res.status(403).json({
                message: 'Access denied - you are not the assigned approver for this task'
            });
        }

        //update approval status
        task.approvals[pendingApprovalIndex].status = status;
        task.approvals[pendingApprovalIndex].comments = comments;
        task.approvals[pendingApprovalIndex].updatedAt = Date.now();

        //update task status based on approval decision
        if( status === 'approved') {
            task.status = TASK_STATUS.COMPLETED;
            task.completedAt = Date.now();
            task.completedBy = req.user.id;
        } else {
            task.status  = TASK_STATUS.NEEDS_REVISION;
        }

        //Add comment about approval decision
        task.comments.push({
            text: `Task ${status} by ${req.user.name}${comments? ': ' + comments : ''}`,
            author: req.user.id,
            createdAt: Date.now()
        });

        //save task
        await  task.save();

        res.json({
            message: 'Task ${status} successfully',
            task
        });
    } catch(error) {
        console.error('Process approval error:', error);
        res.status(500).json({ message: 'Server erro during approval processing' });
    }
};

//addrevision
const addRevision = async (req,res) => {
    try {
        const { description, files } = req.body;

        //find task
        const task = await Task.findById(req.params.id);
        if(!task) {
            return res.status(404).json({ message: 'task not found' });
        }

        if(task.assignedTo.toString() !== req.user.id.toString()) {
            return req.status(403).json({
                messge: 'Access denied - only task assignee can add revisions'
            });
        }

        //calculte next version number
        const nextVersion = task.revisions.length > 0 ?
            Math.max(...task.revisions.map(r => r.version)) + 1: 1;

        //add revision
        task.revisions.push({
            version: nextVersion,
            files: files || [],
            submittedBy: req.user.id,
            submittedAt: Date.now()
        });

        //if task was in NEEDS_REVISION status, change back to UNDER_REVIEW
        if(task.status === TASK_STATUS.NEEDS_REVISION) {
            task.status = TASK_STATUS.UNDER_REVIEW;

            const lastApproval = [...task.approvals]
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

            if(lastApproval) {
                task.approvals.push({
                    status:'pending',
                    approver: lastApproval.approver,
                    updatedAt: Date.now()
                });
            }
        }

        //add comment about new revision
        task.comments.push({
            text: `Revision v${nextVersion} submitted by ${req.user.name}${description ? ': ' + descriptin : ''}`,
            author: req.user.id,
            createdAt: Date.now()
        });

        await task.save();

        res.json({
            message: 'Revision added successfully',
            revision: task.revisions[task.revisions.length - 1],
            task
        });
    } catch (error) {
        console.error('Add revision error:', error);
        res.status(500).json({ message: 'Server error while adding revision' });
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask,
    addComment,
    submitForApproval,
    processTaskApproval,
    addRevision
}