const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { ROLES } = require('../models/userModel');

//all project routes are protected
router.use(protect);

//get all projects 
router.get('/', projectController.getProjects);

//create new project (only coordinator and admin can)
router.post(
    '/',
    authorize(ROLES.ADMIN,ROLES.COORDINATOR),
    projectController.createProject
);

//get project by id
router.get('/:id',projectController.getProjectById);

//update project
router.put('/:id',projectController.updateProject);

//delete project
router.delete('/:id',projectController.deleteProject);

//team member management
router.post('/:id/team', projectController.addTeamMember);
router.delete('/:id/team', projectController.removeTeamMember);

//project notes
router.post('/:id/notes', projectController.addProjectNote);

//project references
router.post('/:id/references',projectController.addProjectRefrence);

module.exports = router;