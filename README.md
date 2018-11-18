# Sketch-RNN and PaperJS NodeJS Sample

This is a sample for how to use the ![Sketch-RNN](https://github.com/mokafolio/SketchRNNNode) NodeJS package.
It uses a provided svg file as input and completes it using sketch rnn. Paperjs is used to parse and flatten the svg file, smooth the resulting paths and save the output svg.

**Sample Input:**

<img src="./SampleFiles/input.svg" width="200px">

**Sample Output:**

<img src="./SampleFiles/test.svg" width="200px">


## How to?

Clone this repository and follow these steps to install all required node dependencies:

```
cd *path to repo*
npm i -S sketchrnn paper-jsdom argparse
```

## Usage

For help, run `node SketchApp.js -h`

which will display this:

```
SketchRNN Node & Paper Example

Optional arguments:
  -h, --help            Show this help message and exit.
  -m MODEL, --model MODEL
                        The SketchRNN model to use
  -i INPUT, --input INPUT
                        Svg to use as input for the sketch
  -o OUTPUT, --output OUTPUT
                        The path to save the resulting output svg file
```

The model argument is *optional*, it will use the bus model by default.

Here is a minimal sample using the `input.svg` sample file that comes with this sample.
`node SketchApp.js -i SampleFiles/input.svg -o output.svg`
