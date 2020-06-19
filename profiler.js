/**
* The `Profiler` module implements functionality related to 
*
* @class Profiler
*/

var Profiler = {};

(function() {
    Profiler._stack = null;
    Profiler.blocks = null;

    Profiler.init = function() {
        Profiler._stack = [];
        Profiler.blocks = {};
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
            if (!(parent.str in block)) {
                block[parent.str] = {
                    counter: 0,
                    totalTime: 0,
                    averageTime: 0                    
                };
            }
            block = block[parent.str];
        }

        let pritem = Profiler._stack.pop();
        let t = endTime-pritem.startTime;

        block.counter += 1;
        block.totalTime += t;
        block.averageTime = block.totalTime / block.counter;
    };

    Profiler.getStatistics = function(block) {

        if (!block) {
            block = Profiler.blocks;
        }
/*        let result = {};
        for (let item in block) {
            console.log(item);
            result[item] = {"_": block[item].averageTime};
        }
*/
        return block;
        
    }
})();


