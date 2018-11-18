//include all the modules needed
const http = require('https');
const paper = require("paper-jsdom"); // paper
const fs = require('fs'); //file system
const ArgumentParser = require("argparse").ArgumentParser;
const sketch = require("sketchrnn"); // sketch-rnn

//setup the command line argument parser
let parser = new ArgumentParser({
    addHelp: true,
    description: 'SketchRNN Node & Paper Example'
});

parser.addArgument(
    ['-m', '--model'], {
        help: 'The SketchRNN model to use',
        required: false,
        defaultValue: "https://storage.googleapis.com/quickdraw-models/sketchRNN/large_models/bus.gen.json"
    }
);

parser.addArgument(
    ['-i', '--input'], {
        help: 'Svg to use as input for the sketch',
        required: true
    }
);

parser.addArgument(
    ['-o', '--output'], {
        help: 'The path to save the resulting output svg file',
        required: true
    }
);

const args = parser.parseArgs();

// initialize paper
paper.setup();

// utility function to load data either locally or remotely (possibly add http in addition later)
function loadData(_uri, _cb) {
    if (_uri.substring(0, 8) == "https://") {
        // load from https
        const request = http.get(_uri,
            res => {
                res.setEncoding("utf8");
                let body = ""
                res.on("data", data => {
                    body += data;
                });
                res.on('end', () => _cb(body));
            });
    } else {
        // load locally
        fs.readFile(_uri, (_err, _data) => {
            if (_err) {
                throw _err;
            }

            _cb(_data);
        });
    }
}

// load the model
loadData(args["model"], setupModel);

function encodeStrokes(_model, _strokes) {
    let modelState = _model.zero_state();
    // encode strokes
    modelState = _model.update(_model.zero_input(), modelState);
    for (let stroke of _strokes) {
        modelState = _model.update(stroke, modelState);
    }
    return modelState;
}

function generateDrawing(_model) {
    return _model.generate();
}

function finishDrawing(_model, _strokes, _temp) {
    let ret = _strokes.slice();
    let modelState = encodeStrokes(_model, _strokes);
    let model_dx, model_dy;
    let model_pen_down, model_pen_up, model_pen_end, model_pdf;
    model_pen_end = 0;
    let model_prev_pen = [0, 1, 0];

    while (model_pen_end !== 1) {
        model_pdf = _model.get_pdf(modelState);
        let things = _model.sample(model_pdf, _temp);
        [model_dx, model_dy, model_pen_down, model_pen_up, model_pen_end] = things;
        ret.push(things)
        modelState = _model.update(things, modelState);
    }

    return ret;
}

// simple function to convert an svg to Stroke3(which sketchrnn needs).
function svgToStroke5(_svgStr, _flatteningError) {
    console.log(_svgStr);

    let ret = [];

    let item = paper.project.importSVG(_svgStr);
    let lastX = 0;
    let lastY = 0;
    // helper to recursively flatten the imported svg/document
    function _recursiveHelper(_item) {
        if (_item.children) {
            for (let item of _item.children) {
                if (item instanceof paper.Path && item.clipMask === false) {
                    item.flatten(_flatteningError);
                    for (let i = 0; i < item.segments.length; ++i) {
                        let dx = i > 0 ? item.segments[i].point.x - lastX : 0;
                        let dy = i > 0 ? item.segments[i].point.y - lastY : 0;
                        let bNextUp = !item.closed && i == item.segments.length - 1 ? 1 : 0;

                        ret.push([dx, dy, !bNextUp, bNextUp, 0]);

                        lastX = item.segments[i].point.x;
                        lastY = item.segments[i].point.y;
                    }

                    if (item.closed) {
                        console.log("CLOSING BROOOO");
                        let dx = item.segments[0].point.x - lastX;
                        let dy = item.segments[0].point.y - lastY;
                        ret.push([dx, dy, 1, 0, 0]);
                    }
                }
                _recursiveHelper(item);
            }
        }
    }

    _recursiveHelper(item);
    item.remove();
    return ret;
}

function setupModel(_json) {
    var modelData = JSON.parse(_json);
    var model = new sketch.SketchRNN(modelData);
    model.set_pixel_factor(1.0);

    loadData(args["input"], _inputSVGBuffer => {
        const inputStrokes = svgToStroke5(_inputSVGBuffer.toString('utf8'), 4);
        const strokes = finishDrawing(model, inputStrokes, 0.25);

        let grp = new paper.Group();
        let currentPath = new paper.Path();
        grp.addChild(currentPath);

        let x = 0,
            y = 0;
        let dx, dy;
        let pen_down, pen_up, pen_end;
        let prev_pen = [1, 0, 0];
        for (let value of strokes) {
            // sample the next pen's states from our probability distribution
            [dx, dy, pen_down, pen_up, pen_end] = value;

            if (prev_pen[2] == 1) { // end of drawing.
                break;
            }

            if (prev_pen[0] == 1) {
                if (!currentPath.segments.length)
                    currentPath.add(x, y);
                currentPath.add(x + dx, y + dy);
            }

            if (pen_up == 1) {
                currentPath.smooth();
                currentPath = new paper.Path();
                grp.addChild(currentPath);
            }

            // update the absolute coordinates from the offsets
            x += dx;
            y += dy;

            // update the previous pen's state to the current one we just sampled
            prev_pen = [pen_down, pen_up, pen_end];
        }

        grp.strokeColor = "black";
        grp.strokeWidth = 1.0;
        grp.fillColor = undefined;

        //fit the document to the drawing bounds
        paper.project.view.size = grp.bounds.size;
        paper.project.view.viewSize = grp.bounds.size;
        paper.project.view.center = grp.position;

        const str = paper.project.exportSVG({ asString: true });

        fs.writeFile("test.svg", str, function(err) {
            if (err) {
                return console.log(err);
            }

            console.log("The file was saved!");
        });
    })
}