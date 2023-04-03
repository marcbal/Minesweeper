var gridDOM = document.getElementById("grid");
var timerDOM = document.getElementById("timer");
var bombCountDOM = document.getElementById("bomb-count");

var input_width = document.getElementById("input-width");
var input_height = document.getElementById("input-height");
var input_mines = document.getElementById("input-mines");

var checkbox_solver_clickable_show = document.getElementById("solver-clickable-show");
var checkbox_solver_clickable_auto = document.getElementById("solver-clickable-auto");
var checkbox_solver_markable_show = document.getElementById("solver-markable-show");
var checkbox_solver_markable_auto = document.getElementById("solver-markable-auto");
var checkbox_solver_combi_auto = document.getElementById("solver-combi-auto");

var input_solver_auto_speed = document.getElementById("solver-auto-speed");

var field = null;

var solver = new Solver();
toggleAutoSolveDiscoverable();
toggleAutoSolveMarkable();
toggleAutoSolveCombi();
updateAutoSolveSpeed();

function changeSettings(width, height, mines) {
    input_width.value = width;
    input_height.value = height;
    input_mines.value = mines;
}

function generateGrid() {

    var width = input_width.value;
    var height = input_height.value;
    var maxMines = width * height - 9;
    var minesCount = input_mines.value;
    if (minesCount > maxMines) {
        minesCount = maxMines;
        input_mines.value = maxMines;
    }

    if (field !== null) {
        field.endGame(false);
    }
    field = new Minefield(width, height, minesCount);
    field.initDOM(gridDOM, timerDOM, bombCountDOM);
    solver.setField(field);
    toggleDiscoverHints(false);
    toggleMarkingHints(false);
}

function toggleDiscoverHints(render) {
    field.discoverHints = checkbox_solver_clickable_show.checked;
    if (render)
        field.renderDOM();
}

function toggleMarkingHints(render) {
    field.markingHints = checkbox_solver_markable_show.checked;
    if (render)
        field.renderDOM();
}


function toggleAutoSolveDiscoverable() {
    solver.autoSolveDiscoverable = checkbox_solver_clickable_auto.checked;
}

function toggleAutoSolveMarkable() {
    solver.autoSolveMarkable = checkbox_solver_markable_auto.checked;
}

function toggleAutoSolveCombi() {
    solver.autoSolveCombi = checkbox_solver_combi_auto.checked;
}

function updateAutoSolveSpeed() {
    solver.updateInterval(input_solver_auto_speed.value);
}




generateGrid();

/*
field.minesCount = 5;
field.grid[0][0].setMine();
field.grid[0][1].setMine();
field.grid[1][0].setMine();
field.grid[2][1].setMine();
field.grid[2][2].setMine();
field.minesPlaced = true;

field.renderDOM();
if (field.timerDOM !== null) {
    field.timeStart = Date.now();
    field.timerInterval = setInterval(() => field.updateTimerDisplay(), 50);
}
*/
