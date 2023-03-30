class Solver {
    constructor() {
        this.tickTimer = null;
        this.autoSolveDiscoverable = false;
        this.autoSolveMarkable = false;
        this.autoSolveCombi = false;

        this.combiSolver = null;
    }


    setField(field) {
        this.field = field;
    }


    tick() {
        if (this.field === null || !this.field.minesPlaced || this.field.ended)
            return false;
        if (this.autoSolveDiscoverable) {
            for (var cell of this.field.getCells(c => c.isSafeToDiscover())) {
                this.stopCombiSolver(); // bypassing combi solver du to simpler solving going on
                cell.leftClick(true);
                return;
            }
        }
        if (this.autoSolveMarkable) {
            for (var cell of this.field.getCells(c => c.isSafeToMark())) {
                this.stopCombiSolver(); // bypassing combi solver du to simpler solving going on
                cell.rightClick(true);
                return;
            }
        }
        if (this.autoSolveCombi && !this.field.solverProbaWaitingPlayer) {
            if (!this.isCombiSolverRunning()) {
                 this.startCombiSolver();
            }
            this.combiSolver.tick();
        }
        else if (this.isCombiSolverRunning()) {
            this.stopCombiSolver();
        }
    }


    isCombiSolverRunning() {
        return this.combiSolver !== null && !this.combiSolver.ended && this.combiSolver.field === this.field;
    }

    startCombiSolver() {
        this.combiSolver = new CombiSolver(this.field);
    }

    stopCombiSolver() {
        if (this.combiSolver !== null) {
            this.combiSolver.end();
            this.combiSolver = null;
        }
    }


    updateInterval(tickPerSec) {
        if (this.tickTimer !== null) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        if (tickPerSec > 0) {
            this.tickTimer = setInterval(() => this.tick(), 1000 / tickPerSec);
        }
    }


}










class CombiSolver {
    constructor(field) {
        this.field = field;
        this.field.lockInteractions = true;

        this.ended = false;
        this.graph = new CombiGraph();
        for (var undisCell of this.field.getCells(c => !c.isDiscovered && !c.isMarked)) {
            for (var disCell of undisCell.getAround(c => c.isDiscovered && c.minesAround > 0)) {
                this.graph.addLink(disCell, undisCell);
            }
        }
        this.undisProba = {};
        this.undisRemainingMines = this.field.minesCount - this.field.getCells(c => c.isMarked).length;

        this.currentSubGraph = -1;
        this.currentSubGraphValidStatesPrev = null;
        this.currentSubGraphStatesNextIndex = 0;

        this.ticker = this.loop();
    }


    *loop() { // generator function (with yield inside)
        this.highlightCells(Object.keys(this.graph.undisToDis));
        yield null;

        this.graph.generateOrderedUndisList();
        yield null;

        var listUndis = this.graph.orderedUndis;

        var states = [];
        var statesCorrespondingDis = [];

        // initial iteration
        for (var i = 0; i < listUndis.length; i++) {
            var arrFalse = new Array(listUndis.length).fill(null);
            arrFalse[i] = false;
            var arrTrue = new Array(listUndis.length).fill(null);
            arrTrue[i] = true;
            states.push([arrFalse, arrTrue]);
            statesCorrespondingDis.push(this.graph.undisToDis[listUndis[i]]);
        }

        while (true) {
            console.log(states);
            for (var i = 0; i < states.length; i++) {
                var listDis = statesCorrespondingDis[i];
                var validStates = [];
                for (var state of states[i]) {
                    if (this.testCombination(state, listUndis, listDis)) {
                        validStates.push(state);
                        this.highlightColoredCells(state, listUndis);
                        yield null;
                    }
                }

                states[i] = validStates;
            }

            if (states.length == 1)
                break; // we have all the valid states

            // merge sets of valid states 2 by 2
            var nextStates = [];
            var nextStatesCorrespondingDis = [];
            for (var i = 0; i < states.length; i += 2) {
                if (i + 1 < states.length) {
                    nextStates.push(this.mergeStateLists(states[i], states[i + 1]));
                    nextStatesCorrespondingDis.push(this.mergeCellsSet(statesCorrespondingDis[i], statesCorrespondingDis[i + 1]));
                }
                else {
                    nextStates.push(states[i]);
                    nextStatesCorrespondingDis.push(statesCorrespondingDis[i]);
                }
            }

            states = nextStates;
            statesCorrespondingDis = nextStatesCorrespondingDis;

        }



        var validStates = states[0];

        var fullProba = validStates.length;
        var countMines = 0;
        var subGraphProba = new Array(listUndis.length).fill(0);
        for (var validState of validStates) {
            for (var i = 0; i < validState.length; i++) {
                if (validState[i]) {
                    subGraphProba[i]++;
                    countMines++;
                }
            }
        }
        var hasSolvableCells = false;
        for (var i = 0; i < listUndis.length; i++) {
            var probaCount = subGraphProba[i];
            if (probaCount == 0 || probaCount == fullProba) {
                hasSolvableCells = true;
                break;
            }
        }
        if (hasSolvableCells) {
            this.end();
            for (var i = 0; i < listUndis.length; i++) {
                var probaCount = subGraphProba[i];
                var cell = this.graph.toCell(listUndis[i]);
                if (probaCount == validStates.length)
                    cell.rightClick(true);
                else if (probaCount == 0)
                    cell.leftClick(true);
            }
            return;
        }
        else {
            // add proba count
            for (var i = 0; i < listUndis.length; i++) {
                var probaCount = subGraphProba[i];
                this.undisProba[listUndis[i]] = probaCount / fullProba;
            }
            this.undisRemainingMines -= countMines / fullProba;
        }

        // compute remaining probas
        var remainingCells = this.field.getCells(c => !c.isDiscovered && !c.isMarked
                && !(this.graph.toKey(c) in this.undisProba));
        var remainingCellsCount = remainingCells.length;
        var remainingProba = this.undisRemainingMines / remainingCellsCount;
        for (var remainingCell of remainingCells) {
            this.undisProba[this.graph.addCell(remainingCell)] = remainingProba;
        }

        var allProbas = Object.values(this.undisProba);
        var minProba = Math.min(...allProbas);
        var maxProba = Math.max(...allProbas);
        // show proba
        for (var cellKey of Object.keys(this.undisProba)) {
            var cell = this.graph.toCell(cellKey);
            cell.solverProba = this.undisProba[cellKey];
            if (cell.solverProba == minProba)
                cell.solverHighlight = "safest";
            else if (cell.solverProba == maxProba)
                cell.solverHighlight = "less-safest";
            else
                cell.solverHighlight = "neutral";
        }
        this.field.renderDOM();
        this.field.lockInteractions = false;
        yield null;

        while (this.field.getCells(c => c.isDiscovered && c.solverProba !== null).length == 0) {
            yield null;
        }
        return;




    }


    tick() {
        var loopRet = this.ticker.next();
        if (loopRet.done)
            this.end();
    }




    testCombination(state, subGraphUndis, subGraphDis) {
        var mapToState = {};
        var countTrue = 0
        for (var i = 0; i < subGraphUndis.length; i++) {
            if (i < state.length && state[i] === true) {
                countTrue++;
            }
            mapToState[subGraphUndis[i]] = i < state.length ? state[i] : null;
        }
        if (countTrue > this.undisRemainingMines) {
            // you cannot have more mines than the number not yet found
            return false;
        }

        for (var disCell of subGraphDis) {
            var actualMine = this.graph.disValue[disCell];
            var countMine = 0;
            var countSafe = 0;
            var countUnknown = 0;
            for (var undisOfDis of this.graph.disToUndis[disCell]) {
                if (mapToState[undisOfDis] === true)
                    countMine++;
                else if (mapToState[undisOfDis] === false)
                    countSafe++;
                else
                    countUnknown++;
            }
            if (countMine + countUnknown < actualMine || countMine > actualMine)
                return false;
        }
        return true;
    }


    mergeStateLists(stateList1, stateList2) {
        var retStateList = [];
        for (var state1 of stateList1) {
            for (var state2 of stateList2) {
                var state = [];
                for (var i = 0; i < state1.length && i < state2.length; i++) {
                    state.push(state1[i] !== null ? state1[i] : state2[i]);
                }
                retStateList.push(state);
            }
        }
        return retStateList;
    }

    mergeCellsSet(cells1, cells2) {
        return cells1.concat(cells2.filter(i => cells1.indexOf(i) < 0));
    }


    end() {
        if (this.ended)
            return;
        this.field.lockInteractions = false;
        for (var cell of this.field.getAllCells()) {
            cell.solverProba = null;
        }
        this.highlightCells([]);
        this.ended = true;
    }


    highlightCells(keysList) {
        for (var cell of this.field.getAllCells()) {
            cell.solverHighlight = keysList.includes(this.graph.toKey(cell)) ? "neutral" : null;
        }
        this.field.renderDOM();
    }

    highlightColoredCells(state, subGraphUndis) {
        var mapToState = {};
        for (var i = 0; i < subGraphUndis.length; i++) {
            mapToState[subGraphUndis[i]] = i < state.length ? state[i] : null;
        }
        //console.log(mapToState);
        for (var cell of this.field.getAllCells()) {
            var key = this.graph.toKey(cell);
            if (key in mapToState) {
                if (mapToState[key] == true)
                    cell.solverHighlight = "bomb";
                else if (mapToState[key] == false)
                    cell.solverHighlight = "safe";
                else
                    cell.solverHighlight = "neutral";
            }
            else
                cell.solverHighlight = null;
        }
        this.field.renderDOM();
    }
}






class CombiGraph {
    constructor() {
        this.disToUndis = {};
        this.undisToDis = {};
        this.disValue = {};
        this.probaValues = {};
        this.cellObjs = {};
        this.orderedUndis = [];
    }

    addLink(disCell, undisCell) {
        var disKey = this.addCellWithValue(disCell);
        var undisKey = this.addCell(undisCell);
        if (!(disKey in this.disToUndis))
            this.disToUndis[disKey] = [];
        this.disToUndis[disKey].push(undisKey);
        if (!(undisKey in this.undisToDis))
            this.undisToDis[undisKey] = [];
        this.undisToDis[undisKey].push(disKey);
    }

    addCellWithValue(cell) {
        var key = this.addCell(cell);
        if (!(key in this.disValue)) {
            var value = cell.minesAround - cell.countMarkedAround();
            this.disValue[key] = value;
        }
        return key;
    }

    addCell(cell) {
        var key = this.toKey(cell);
        if (!(key in this.cellObjs)) {
            this.cellObjs[key] = cell;
        }
        return key;
    }

    toKey(cell) {
        return cell.r + ":" + cell.c;
    }

    toCell(key) {
        return this.cellObjs[key];
    }



    generateOrderedUndisList() {
        var subGraphUndis = Object.keys(this.undisToDis);
        var subGraphDis = Object.keys(this.disToUndis);

        var proximities = {};
        var distances = {};
        var mergedProximities = {};
        var mergedDistances = {};
        for (var undis1 of subGraphUndis) {
            proximities[undis1] = {};
            distances[undis1] = {};
            mergedProximities[undis1] = 0;
            mergedDistances[undis1] = 10000; // big enough number
            for (var undis2 of subGraphUndis) {
                distances[undis1][undis2] = this.distance(undis1, undis2);
                proximities[undis1][undis2] = this.disProximity(undis1, undis2);
            }
        }

        // the actual sorting
        for (var i = 0; i < subGraphUndis.length - 1; i++) {
            var undis1 = subGraphUndis[i];

            var maxProximity = -1;
            var minDistance = 10000;
            var maxIndex = i + 1;
            for (var j = i + 1; j < subGraphUndis.length; j++) {
                var undis2 = subGraphUndis[j];
                // give bonus to undis1 as proximity
                mergedProximities[undis2] = Math.max(mergedProximities[undis2], proximities[undis1][undis2]);
                mergedDistances[undis2] = Math.min(mergedDistances[undis2], distances[undis1][undis2]);
                if (mergedProximities[undis2] > maxProximity
                    || (mergedProximities[undis2] == maxProximity
                        && mergedDistances[undis2] < minDistance
                        )
                    ) {
                    maxProximity = mergedProximities[undis2];
                    minDistance = mergedDistances[undis2];
                    maxIndex = j;
                }
            }
            if (maxIndex != i + 1) {
                var tmp = subGraphUndis[i + 1];
                subGraphUndis[i + 1] = subGraphUndis[maxIndex];
                subGraphUndis[maxIndex] = tmp;
            }
        }



        this.orderedUndis = subGraphUndis;
    }

    /**
        Determine the proximity of 2 undiscovered cells, based on the number of
        discovered cells they have in common
        */
    disProximity(undis1, undis2) {
        var count = 0;
        var dis2List = this.undisToDis[undis2];
        for (var dis1 of this.undisToDis[undis1]) {
            if (dis2List.includes(dis1))
                count++;
        }
        return count;
    }


    distance(undis1, undis2) {
        var c1 = this.toCell(undis1);
        var c2 = this.toCell(undis2);
        return Math.abs(c1.r - c2.r) + Math.abs(c1.c - c2.c)
    }


}
