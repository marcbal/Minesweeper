class Solver {
    constructor() {
        this.tickTimer = null;
        this.autoSolveDiscoverable = false;
        this.autoSolveMarkable = false;
        this.showCombiResults = false;
        this.autoSolveCombi = false;
        this.field = null;

        this.combiSolver = null;
    }


    setField(field) {
        this.field = field;
    }


    tick() {
        if (this.field === null || !this.field.minesPlaced || this.field.ended)
            return false;
        if (this.autoSolveDiscoverable || this.field.discoverHints) {
            for (var cell of this.field.getCells(c => c.isSafeToDiscover())) {
                this.stopCombiSolver(); // bypassing combi solver du to simpler solving going on
                if (this.autoSolveDiscoverable)
                    cell.leftClick(true);
                return;
            }
        }
        if (this.autoSolveMarkable || this.field.markingHints) {
            for (var cell of this.field.getCells(c => c.isSafeToMark())) {
                this.stopCombiSolver(); // bypassing combi solver du to simpler solving going on
                if (this.autoSolveMarkable)
                    cell.rightClick(true);
                return;
            }
        }
        if ((this.autoSolveCombi || this.showCombiResults)) {
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
        this.combiSolver = new CombiSolver(this, this.field);
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
    constructor(solver, field) {
        this.mainSolver = solver;
        this.field = field;
        this.field.lockInteractions = true;

        this.ended = false;
        this.graph = new CombiGraph(field);
        for (var undisCell of this.field.getCells(c => !c.isDiscovered && !c.isMarked)) {
            for (var disCell of undisCell.getAround(c => c.isDiscovered && c.minesAround > 0)) {
                this.graph.addLink(disCell, undisCell);
            }
        }
        this.graph.generateOrderedUndisList();
        this.undisProba = {};
        this.undisRemainingMines = this.field.minesCount - this.field.getCells(c => c.isMarked).length;
        this.otherUndisCount = this.field.getCells(c => !c.isDiscovered && !c.isMarked && !(c.key in this.graph.undisToDis)).length;

        this.ticker = this.loop();
    }


    *loop() { // generator function (with yield inside)
        this.highlightCells(Object.keys(this.graph.undisToDis));
        yield null;

        var listUndis = this.graph.orderedUndis;
        console.log("Starting new solver instance. Order of cells: ", listUndis);

        var states = new Array(listUndis.length);
        var statesCorrespondingDis = new Array(listUndis.length);

        // initial iteration
        for (var i = 0; i < listUndis.length; i++) {
            states[i] = [];
            var base = "-".repeat(listUndis.length);
            states[i].push(base.replaceAt(i, "s"));
            states[i].push(base.replaceAt(i, "m"));
            statesCorrespondingDis[i] = this.graph.undisToDis[listUndis[i]];
            // pre-filter on first iteration
            states[i] = yield* this.filterValidCombination(states[i], listUndis, statesCorrespondingDis[i]);
        }

        while (true) {
            //console.log("Starting iteration of solver.")
            //console.log("  Valid sub-states count: " + states.map(s => s.length).join(", ") + " (sum= " + states.map(s => s.length).reduce((a, v) => a + v, 0) + ")");

            // check for already solved cells
            var hasSolvableCells = false;
            var finalState = "-".repeat(listUndis.length);
            for (var subStates of states) {
                var subStateSol = this.verifySolvedCells(subStates);
                if (subStateSol.solved) {
                    hasSolvableCells = true;
                    finalState = this.mergeStateLists([finalState], [subStateSol.solution])[0];
                }
            }
            if (hasSolvableCells && this.mainSolver.autoSolveCombi) {
                this.end();
                console.log("  Found premature solution: " + finalState);
                for (var i = 0; i < listUndis.length; i++) {
                    var cell = this.field.keyToCell[listUndis[i]];
                    if (finalState[i] == "m")
                        cell.rightClick(true);
                    else if (finalState[i] == "s")
                        cell.leftClick(true);
                }
                return;
            }


            if (states.length <= 1)
                break; // we have all the valid states in one set, or no states at all

            // merge sets of valid states 2 by 2
            var nextStates = [];
            var nextStatesCorrespondingDis = [];
            for (var i = 0; i < states.length; i += 2) {
                if (i + 1 < states.length) {
                    var states1 = states[i];
                    var disSet1 = statesCorrespondingDis[i];
                    var states2 = states[i + 1];
                    var disSet2 = statesCorrespondingDis[i + 1];

                    /*
                    The improvement below aims at filtering a subpart of the states
                    from the previous loop, before the actual merge of all the states
                    happends, so we save as much as possible iteration on testing the
                    validity of each merged states later.

                    The considered subparts to be tested are the cells that affects
                    cells of the opposing subset (the common discovered cells)
                    */

                    var commonDis = disSet1.intersection(disSet2);
                    var disUnion = disSet1.union(disSet2);

                    var undisOfCommonDisSet = [...commonDis].map(dis => this.graph.disToUndis[dis])
                            .reduce((acc, undisSet) => {
                                acc.addAll(undisSet);
                                return acc;
                            }, new Set());
                    //console.log("  Merging with common discovered cells: " + ([...undisOfCommonDisSet].join(", ")));
                    var indexOfUndisOfCommonDis = [...undisOfCommonDisSet].map(undis => listUndis.indexOf(undis));

                    var states1GroupedByUndisOfCommonDis = this.groupStatesBySubsetState(states1, indexOfUndisOfCommonDis);
                    var states2GroupedByUndisOfCommonDis = this.groupStatesBySubsetState(states2, indexOfUndisOfCommonDis);
                    var len1 = Object.keys(states1GroupedByUndisOfCommonDis).length;
                    var len2 = Object.keys(states2GroupedByUndisOfCommonDis).length;
                    //console.log("  Merging " + len1 + " × " + len2 + " keys. Should give max " + (len1 * len2) + " merged keys.");
                    var finalMergedStateList = [];
                    var countValidMergedKeys = 0;
                    for (var group1key of Object.keys(states1GroupedByUndisOfCommonDis)) {
                        var group1states = states1GroupedByUndisOfCommonDis[group1key];
                        for (var group2key of Object.keys(states2GroupedByUndisOfCommonDis)) {
                            var group2states = states2GroupedByUndisOfCommonDis[group2key];
                            var mergedKey = this.mergeStates(group1key, group2key);
                            if (yield* this.testCombinationShowIfValid(mergedKey, listUndis, commonDis)) {
                                countValidMergedKeys++;
                                finalMergedStateList.push(... this.mergeStateLists(group1states, group2states).filter(state => this.testMinesCount(state)));
                            }
                        }
                    }
                    //console.log("    Valid merged keys: " + countValidMergedKeys + "; Merged states count: " + finalMergedStateList.length);

                    nextStates.push(finalMergedStateList);
                    nextStatesCorrespondingDis.push(disSet1.union(disSet2));
                }
                else {
                    nextStates.push(states[i]);
                    nextStatesCorrespondingDis.push(statesCorrespondingDis[i]);
                }
            }

            states = nextStates;
            statesCorrespondingDis = nextStatesCorrespondingDis;

        }


        if (states.length > 0) {
            var validStates = states[0];
            console.log("  Ending solver with all valid states: ", validStates);

            var fullProba = validStates.length;
            var countMines = 0;
            var subGraphProba = new Array(listUndis.length).fill(0);
            for (var validState of validStates) {
                for (var i = 0; i < validState.length; i++) {
                    if (validState[i] == "m") {
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
            if (hasSolvableCells && this.mainSolver.autoSolveCombi) {
                this.end();
                console.log("  Found unique solution: " + finalState);
                for (var i = 0; i < listUndis.length; i++) {
                    var probaCount = subGraphProba[i];
                    var cell = this.field.keyToCell[listUndis[i]];
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
        }


        // compute remaining probas
        var remainingCells = this.field.getCells(c => !c.isDiscovered && !c.isMarked
                && !(c.key in this.undisProba));
        var remainingCellsCount = remainingCells.length;

        // check if remaining mines are safe or are bombs for sure.
        if (remainingCellsCount > 0 &&
            (this.undisRemainingMines == 0 || this.undisRemainingMines == remainingCellsCount)) {
            var areSafe = this.undisRemainingMines == 0;
            this.end();
            for (var remainingCell of remainingCells) {
                if (areSafe)
                    remainingCell.leftClick(true);
                else
                    remainingCell.rightClick(true);
            }
            return;
        }

        var remainingProba = this.undisRemainingMines / remainingCellsCount;
        for (var remainingCell of remainingCells) {
            this.undisProba[remainingCell.key] = remainingProba;
        }

        var allProbas = Object.values(this.undisProba);
        var minProba = Math.min(...allProbas);
        var maxProba = Math.max(...allProbas);
        // show proba
        for (var cellKey of Object.keys(this.undisProba)) {
            var cell = this.field.keyToCell[cellKey];
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




    *filterValidCombination(states, listUndis, listDis) {
        var validStates = [];
        for (var state of states) {
            if (yield* this.testCombinationShowIfValid(state, listUndis, listDis))
                validStates.push(state);
        }
        return validStates;
    }



    verifySolvedCells(states) {
        var hasSolved = false;
        var solution = "";
        if (states.length > 0) {
            var stateSize = states[0].length;
            var stateCount = states.length;
            for (var i = 0; i < stateSize; i++) {
                var countMine = 0;
                var countSafe = 0;
                for (var state of states) {
                    if (state[i] == "m")
                        countMine++;
                    else if (state[i] == "s")
                        countSafe++;
                }
                if (countMine == stateCount) {
                    hasSolved = true;
                    solution += "m";
                }
                else if (countSafe == stateCount) {
                    hasSolved = true;
                    solution += "s";
                }
                else
                    solution += "-";
            }
        }
        return {
            "solved": hasSolved,
            "solution": solution
        }
    }


    *testCombinationShowIfValid(state, listUndis, listDis) {
        var valid = this.testCombination(state, listUndis, listDis);
        if (valid) {
            this.highlightColoredCells(state, listUndis);
            yield null;
        }
        return valid;
    }

    testMinesCount(state) {
        var countMines = 0;
        var countUnknown = 0;
        for (var s of state) {
            if (s == "m")
                countMines++;
            else if (s == "-")
                countUnknown++;
        }
        return countMines <= this.undisRemainingMines && countMines + countUnknown >= this.undisRemainingMines - this.otherUndisCount;
    }

    testCombination(state, subGraphUndis, subGraphDis) {
        if (!this.testMinesCount(state))
            return false;
        var mapToState = {};
        for (var i = 0; i < subGraphUndis.length; i++) {
            mapToState[subGraphUndis[i]] = i < state.length ? state[i] : "-";
        }

        for (var disCell of subGraphDis) {
            var actualMine = this.graph.disValue[disCell];
            var countMine = 0;
            var countSafe = 0;
            var countUnknown = 0;
            for (var undisOfDis of this.graph.disToUndis[disCell]) {
                if (mapToState[undisOfDis] == "m")
                    countMine++;
                else if (mapToState[undisOfDis] == "s")
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
                retStateList.push(this.mergeStates(state1, state2));
            }
        }
        return retStateList;
    }


    mergeStates(state1, state2) {
        var state = "";
        for (var i = 0; i < state1.length && i < state2.length; i++) {
            state += state1[i] !== "-" ? state1[i] : state2[i];
        }
        return state;
    }


    groupStatesBySubsetState(states, keysIndex) {
        var stateToKey = function(state, keysIndex) {
            var ret = "";
            for (var i = 0; i < state.length; i++) {
                ret += keysIndex.includes(i) ? state[i] : "-";
            }
            return ret;
        }

        var ret = {};
        for (var state of states) {
            var key = stateToKey(state, keysIndex);
            if (!(key in ret))
                ret[key] = [];
            ret[key].push(state);
        }
        return ret;
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
            cell.solverHighlight = keysList.includes(cell.key) ? "neutral" : null;
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
            var key = cell.key;
            if (key in mapToState) {
                if (mapToState[key] == "m")
                    cell.solverHighlight = "bomb";
                else if (mapToState[key] == "s")
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
    constructor(field) {
        this.field = field;
        this.disToUndis = {};
        this.undisToDis = {};
        this.disValue = {};
        this.probaValues = {};
        this.orderedUndis = [];
    }

    addLink(disCell, undisCell) {
        var disKey = this.addCellWithValue(disCell);
        var undisKey = undisCell.key;
        if (!(disKey in this.disToUndis))
            this.disToUndis[disKey] = new Set();
        this.disToUndis[disKey].add(undisKey);
        if (!(undisKey in this.undisToDis))
            this.undisToDis[undisKey] = new Set();
        this.undisToDis[undisKey].add(disKey);
    }

    addCellWithValue(cell) {
        var key = cell.key;
        if (!(key in this.disValue)) {
            var value = cell.minesAround - cell.countMarkedAround();
            this.disValue[key] = value;
        }
        return key;
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
                var consideredDistance = Math.min(mergedDistances[undis2], distances[undis1][undis2] <= 1 ? 0 : distances[undis1][undis2]);
                mergedDistances[undis2] = Math.min(mergedDistances[undis2], distances[undis1][undis2]);
                if (mergedProximities[undis2] > maxProximity
                    || (mergedProximities[undis2] == maxProximity
                        && consideredDistance < minDistance
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
        return this.undisToDis[undis1].intersection(this.undisToDis[undis2]).size;
    }


    distance(undis1, undis2) {
        var c1 = this.field.keyToCell[undis1];
        var c2 = this.field.keyToCell[undis2];
        return Math.abs(c1.r - c2.r) + Math.abs(c1.c - c2.c)
    }


}
