/**
* The `Profiler` module implements functionality related to 
*
* @class Profiler
*/

var Profiler = {};

(function() {
    Profiler._stack = null;
    Profiler.blocks = null;
    Profiler._indent = "    ";
    Profiler._newLine = "\n";
    Profiler._otherBlockName = "_other";
    Profiler._msSuffix = "ms";

    Profiler.init = function() {
        Profiler._stack = [];
        Profiler.blocks = {blocks: {}};
    };

    Profiler.begin = function(str) {
        if (!Profiler._stack) return;
        let pritem = {
            str: str,
            startTime: performance.now()
        };
        Profiler._stack.push(pritem);
    };

    Profiler.end = function() {
        if (!Profiler._stack) return;
        let endTime = performance.now();

        let block = Profiler.blocks;
        for (let parent of Profiler._stack) {
            if (!(parent.str in block.blocks)) {
                block.blocks[parent.str] = {
                    counter: 0,
                    totalTime: 0,
                    averageTime: 0,
                    blocks: {}
                };
            }
            block = block.blocks[parent.str];
        }

        let pritem = Profiler._stack.pop();
        let t = endTime-pritem.startTime;

        block.counter += 1;
        block.totalTime += t;
        block.averageTime = block.totalTime / block.counter;
    };

    Profiler.getStatistics = function(clearStatistics) {
        let s = "";
        let topBlock = Profiler.blocks;
        for (blockName in topBlock.blocks) {
            s += Profiler.getStatisticsRec(topBlock.blocks[blockName], blockName, "", topBlock.blocks[blockName].counter);
        }

        if (clearStatistics) {
            Profiler._stack = [];
            Profiler.blocks = {blocks: {}};
        }

        return s;        
    }

    Profiler.getStatisticsRec = function(block, blockName, indent, globalCounter) {
        let s = "";
        s += indent + blockName + ": " + (block.totalTime/globalCounter).toFixed(2) + Profiler._msSuffix + Profiler._newLine;
        let totalSubblocksTime = 0;
        let anySubblocks = false;
        for (blockName in block.blocks) {
            s += Profiler.getStatisticsRec(block.blocks[blockName], blockName, indent+Profiler._indent, globalCounter);
            totalSubblocksTime += block.blocks[blockName].totalTime;
            anySubblocks = true;
        }
        if (anySubblocks) {
            s += indent + Profiler._indent + Profiler._otherBlockName + ": " + ((block.totalTime-totalSubblocksTime)/globalCounter).toFixed(2) + Profiler._msSuffix + Profiler._newLine;
        }
        return s;
    }
})();


