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
    Profiler._trashhold = 0.000005;

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
                    maxTime: 0,
                    startTime: endTime,
                    endTime: endTime,
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
        block.endTime = endTime;
        block.fps = block.counter*1000/(block.endTime-block.startTime);
        if (t>block.maxTime) block.maxTime = t;
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
    };

    Profiler._stars = function(ms) {
       let quant = 0.2;
       if (ms<quant) {
           return "";
       } else {
           let s = "[";
           while (ms>quant) {
               ms -= quant;
               s += "*";
           }
           s += "]";
           return s;
       }
    };

    Profiler.getStatisticsRec = function(block, blockName, indent, globalCounter) {
        if (block.totalTime/globalCounter<Profiler._trashhold) return "";
        let s = "";
        if (indent=="") {
            //Top level block
            s += indent + (block.totalTime/globalCounter).toFixed(2) + Profiler._msSuffix + " " + blockName + " (fps: " + block.fps.toFixed(2) + ")" + Profiler._stars(block.totalTime/globalCounter) + Profiler._newLine;
        } else {
            //Sub-block
            s += indent + (block.totalTime/globalCounter).toFixed(2) + Profiler._msSuffix + " " + blockName + Profiler._stars(block.totalTime/globalCounter) + Profiler._newLine;
        }
        let totalSubblocksTime = 0;
        let anySubblocks = false;

        let blockNames = Object.keys(block.blocks);
        blockNames.sort(function (a,b) {
            return (block.blocks[b].totalTime-block.blocks[a].totalTime);
        });

        for (blockName of blockNames) {
            if (block.blocks[blockName].totalTime/globalCounter>Profiler._trashhold) {
                s += Profiler.getStatisticsRec(block.blocks[blockName], blockName, indent+Profiler._indent, globalCounter);
                totalSubblocksTime += block.blocks[blockName].totalTime;
            }
            anySubblocks = true;
        }
        if (anySubblocks && (block.totalTime-totalSubblocksTime)/globalCounter > Profiler._trashhold) {
            s += Profiler._indent + indent + ((block.totalTime-totalSubblocksTime)/globalCounter).toFixed(2) + Profiler._msSuffix + " " + Profiler._otherBlockName + Profiler._stars((block.totalTime-totalSubblocksTime)/globalCounter) + Profiler._newLine;
        }
        return s;
    }
})();


