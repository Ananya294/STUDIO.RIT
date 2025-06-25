const { Project, PROJECT_STATUS } = require("../models/projectModel");
const { User, ROLES } = require("../models/userModel");

//create project
const createProject = async (req, res) => {
    try {
        const {
            title,
            description,
            startDate,
            endDate,
            coordinator,
            departments,
            tags
        } = req.body;

        //validate end date after start date
        if(startDate && endDate)
        {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if(end <= start)
            {
                return res.status(400).json({
                    message: 'end date must be after start date'
                });
            }
        }

        //validate coordinator exits and has apt roles
        const coordinatorUser = await User.findById(coordinator);
        if(!coordinatorUser){
            return res.status(400).json({ message: 'Coordinator not found'});
        }

        if(!coordinatorUser.hasPermission(ROLES.COORDINATOR)) {
            return res.status(400).json({
                message: 'Select coordinator does not have coordinator privileges'
            });
        }

        //create new project
        const project = new Project({
            title,
            description,
            startDate,
            endDate,
            createdBy: req.user.id,
            coordinator,
            departments: departments || [],
            tags: tags || []
        });

        await project.save();

        res.status(201).json({
            message: "Project created successfully",
            project
        });
    } catch (error) {
        console.error("Project creation error:", error);
        res.status(500).json({ message: "Server error during project creation"});
    }
};

//get all projects (with filtering options)
const getProjects = async (req, res) => {
    try {
        const {
            status,
            department,
            tag,
            startAfter,
            endBefore,
            coordinator,
            search
        } = req.query;

        //filter object
        const filter = {};

        //apply filters if exist
        if (status) filter.status = status;
        if (department) filter.departments = department;
        if (tag) filter.tags = tag;
        if (coordinator) filter.coordinator = coordinator;

        //date filter
        if(startAfter) filter.startDate = { $gte: new Date(startAfter)};
        if(endBefore) filter.endDate = { $lte: new Date(endBefore)};

        //search in title or description
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i"}},
                { descrition: { $regex: search, $options: "i"}}
            ];
        }

        //role-based filtering
        //if not admin or coordinator, only show projects they're part of
        if(![ROLES.ADMIN, ROLES.COORDINATOR].includes(req.user.role)) {
            filter.$or = filter.$or || [];
            filter.$or.push(
                { coordinator: req.user.id},
                { 'teamMembers.user': req.user.id },
                { createdBy: req.user.id }
            );
        }
        //query with populated fields
        const projects = await Project.find(filter)
            .populate('createdBy','name email')
            .populate('coordinator', 'name email')
            .populate('teamMembers.user', 'name email')
            .sort({ createdAt: -1});
        
            res.json({
                count: projects.length,
                projects
            });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ message: 'Server error while fetching projects' });
    }
};

//get single project by id
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('coordinator', 'name email')
            .populate('teamMembers.user', 'name email')
            .populate('notes.addedBy', 'name email')
            .populate('references.addedBy', 'name email')

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        //access control - check if user is authorized to view this project
        const isTeamMember = project.isTeamMember(req.user.id);
        const isCoordinator = project.coordinator._id.toString()  === req.user.id.toString();
        const isCreator = project.createdBy._id.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if(!(isTeamMember || isCoordinator || isCreator || isAdmin)) {
            return res.status(403).json({
                message: "Access denied - you are not part of this project team"
            });
        }
        res.json({ project });

        } catch (error) {
            console.error("Get project error:", error);
            res.status(500).json({ message: "Server error while fetching project"});
        }    
};

//update a project
const updateProject = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            startDate,
            endDate,
            coordinator,
            departments,
            tags
        } = req.body;

        //find the project
        const project = await Project.findById(req.params.id);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        //access control - only coordinator, creator or admin can update
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isCreator = project.createdBy.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if(!(isCoordinator || isCreator || isAdmin)) {
            return res.status(403).json({
                message: "Access denied - only project coordinator, creator or admin can update the project"
            });
        }

        // If changing coordinator, validate
        if (coordinator && coordinator !== project.coordinator.toString()) {
            const coordinatorUser = await User.findById(coordinator);
            if (!coordinatorUser) {
                return res.status(400).json({ message: 'Coordinator not found' });
            }

            if (!coordinatorUser.hasPermission(ROLES.COORDINATOR)) {
                return res.status(400).json({ 
                message: 'Selected user does not have coordinator privileges' 
                });
            }
        }

        //update project fields
        if (title) project.title = title;
        if (description) project.description = description;
        if (status) project.status = status;
        if (startDate) project.startDate = startDate;
        if (endDate) project.endDate = endDate;
        if (coordinator) project.coordinator = coordinator;
        if (departments) project.departments = departments;
        if (tags) project.tags = tags;

        //save updated project
        await project.save();

        res.json({
            message:"Project updated successfully"
        });   
    } catch (error) {
        console.error("Update project error:",error);
        res.status(500).json({ message: "Server error during project update" });
    }
};

//delete a project

const deleteProject = async (req,res) => {
    try {
        const project = await Project.findById(req.params.id);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isCreator = project.createdBy.toString() === req.user.id.toString();
        const isAdmin = req.user.role == ROLES.ADMIN;

        if(!(isCreator || isAdmin)) {
            return res.status(403).json({
                message: "Access denied - only project creator or admin can delete the project"
            });
        }

        //delete project
        await Project.findByIdAndDelete(req.params.id);

        res.json({ message: "Project delted successfully" });
 
    } catch (error) {
        console.error("Delete project error:", error);
        res.status(500).json({ message: "Server error during project deletion" });
    }
};

//add team members to project
const addTeamMember = async (req, res) => {
    try {
        const { userId, role } = req.body;

        //find project
        const project = await Project.findById(req.params.id);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        //access control = only coord, creator or admin can add members
        const isCreator = project.createdBy.toString() === req.user.id.toString();
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if( !(isCoordinator || isCreator || isAdmin)) {
            return res.status(403).json({
                message: "Access denied - only project coordinator creator or admin can add team members"
            });
        }

        //check if users exist
        const user = await User.findById(userId);
        if(!user) {
            return res.status(400).json({ message: "User not found" });
        }

        //check if user is already a team member
        if (project.isTeamMember(userId)) {
            return res.status(404).json({ message: "User is already a team member"});
        }

        //add user to team
        project.teamMembers.push({
            user: userId,
            role: role,
            addedAt: new Date()
        });
        

        //save project
        await project.save();

        //populate and return updated project
        const updatedProject = await Project.findById(req.params.id)
            .populate('teamMembers.user', 'name email');

        res.json({
            message: " team member added successfully", 
            project: updatedProject
        });
    } catch (error) {
        console.error("add team member error",error);
        res.status(500).json({ message: "Server error while removing team meber" });

    }
};


//remove team members from project
const removeTeamMember = async (req, res) => {
    try {
        const { userId } = req.body;

        //find project
        const project = await Project.findById(req.params.id);

        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        //access control = only coord, crator or admin can add members
        const isCreator = project.createdBy.toString() === req.user.id.toString();
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if( !(isCoordinator || isCreator || isAdmin)) {
            return res.status(403).json({
                message: "Access denied - only project coordinator creator or admin can add team members"
            });
        }

        //check if users exist
        const user = await User.findById(userId);
        if(!user) {
            return res.status(400).json({ message: "User not found" });
        }

        //check if user is already a team member
        if (!project.isTeamMember(userId)) {
            return res.status(400).json({ message: "User is not a team member"});
        }

        //remove user from team
        project.teamMembers = project.teamMembers.filter(
            member => member.user.toString() !== userId
        );
        

        //save project
        await project.save();

        //populate and return updated project
        const updatedProject = await Project.findById(req.params.id)
            .populate('teamMembers.user','name email');


        res.json({
            message: " team member removed successfully", 
            project: updatedProject
        });
    } catch (error) {
        console.error("remove team member error",error);
        res.status(500).json({ message: "Server error while removing team meber" });

    }
};



//add note to project
const addProjectNote = async (req, res) => {
    try {
        const { content } = req.body;

         // Find project
        const project = await Project.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Access control - must be team member, coordinator or admin
        const isTeamMember = project.isTeamMember(req.user.id);
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;
        const isCreator = project.createdBy.toString() === req.user.id.toString();

        if (!(isTeamMember || isCoordinator || isAdmin || isCreator)) {
            return res.status(403).json({ 
                message: 'Access denied - you must be a team member to add notes' 
            });
        }

        //add note
        project.notes.push({
            content,
            addedBy: req.user.id,
            addedAt: new Date()
        });

        //save project
        await project.save();

        //return the added note with populated user
        const updatedProject = await Project.findById(req.params.id)
            .populate('notes.addedBy','name email');

        const addedNote = updatedProject.notes[updatedProject.notes.length-1];

        res.json({
            message: 'Note added successfully',
            note: addedNote
        })
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({message: 'Server error while adding note'});
    }
};

//add reference to project

const addProjectReference = async (req, res) => {
    try {
        const { title, url, type } = req.body;

        //validate required field
        if(!title || !url)
        {
            return res.status(400).json({ message: 'Title and URL are required' });
        }

        //find project
        const project = await Project.findById(req.params.id);

        if(!project) {
            return res.status(404).json({ message: 'Project not found'});
        }

        //access control - must be team member, coordinator or admin
        const isTeamMember = project.isTeamMember(req.user.id);
        const isCoordinator = project.coordinator.toString() === req.user.id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN; 
        const isCreator = project.createdBy.toString() === req.user.id.toString();

        if (!(isTeamMember || isCoordinator || isAdmin || isCreator)) {
            return res.status(403).json({ 
                message: 'Access denied - you must be a team member to add references' 
            });
        }

        //add reference
        project.references.push({
            title,
            url,
            type: type || 'link',
            addedAt: new Date(),
            addedBy: req.user.id
        });

        //save project
        await project.save();

        const updatedProject = await Project.findById(req.params.id)
            .populate('references.addedBy', 'name email');

        const addedReference = updatedProject.references[updatedProject.references.length - 1];

        res.json({
            message: 'Reference added succesfully',
            reference: addedReference
        });

    } catch (error) {
        console.error('Add reference error:', error);
        res.status(500).json({ message: 'Server while adding reference' });
    }
};

module.exports = {
    createProject,
    addProjectReference,
    addProjectNote,
    addTeamMember,
    removeTeamMember,
    deleteProject,
    updateProject,
    getProjectById,
    getProjects
}
