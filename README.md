# MVPT
## Minimum Viable Plotter Tool

This is a very rough and ready tool that I wrote for _myself_ to use to remotely control an AxiDraw pen plotter. It was written with my own very specific needs, which is why I haven't made it public before. _However_, some people may find it useful enough to use, you're absolutely on your own with this one!

It's a small web services that runs on the machine connected to the pen plotter, and uses the command line API to talk to the AxiDraw: https://axidraw.com/doc/cli_api/

I run this on OSX running on a MacMini, which I then connect to from my laptop or phone to control, it's ***very*** untested on PC.

![UI](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/ui.png?token=GHSAT0AAAAAACBGWLNWNW7IITEBH6QPZKOKZB6SOFQ)

----

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Danger](#danger)
5. [License](#license)

----

## Prerequisites

- You will need Node.js, to run the webserver
- Python 3.7, for the AxiDraw command line tools
- axicli 3.8.1+ command line tools https://axidraw.com/doc/cli_api/#installation
- EBB firmware 2.6.2 (for Walk Home command) https://axidraw.com/fw

----

## Installation

Follow these steps to install and set up the project on your local machine:

1. Install node.js, axicli and update your EBB firmware
2. Clone the repository: `git clone https://github.com/revdancatt/remote-plotting.git`
3. Run `npm install`
4. Copy `.env.example` to `.env` and edit it to update your environment variables
5. Start it with `npm start`
6. Visit `localhost:2000` locally, or wherever it's running on your _local_ network (you could [ngrok](https://ngrok.com/product) it to the outside world I guess, I haven't done that though)

Example .env file...

```
PORT=2000
NODE_ENV=DEV
ISLOCAL=true
SVGDIR=/Users/danielcatt/Downloads
DEFAULTSPEED=20
MODEL=1
WEBHOOK=
```

`SVGDIR` should point to where you generally keep your .svg files for plotting, the ui will allow you to drill down into subdirectories if you want to keep things organised.

`MODEL` is the model of AxiDraw you have, see https://axidraw.com/doc/cli_api/#model for more details

* 1 - AxiDraw V2, V3, or SE/A4
* 2 - AxiDraw V3/A3 or SE/A3
* 3 - AxiDraw V3 XLX
* 4 - AxiDraw MiniKit
* 5 - AxiDraw SE/A1
* 6 - AxiDraw SE/A2
* 7 - AxiDraw V3/B6

`WEBHOOK` can be set to hit a URL once the plot has finished, for notifications. For example my WEBHOOK running on IFTTT is `https://maker.ifttt.com/trigger/axidraw_finished/with/key/[API KEY]` which emails me the "Finished" email. You could set up a local web endpoint to play a sound all the way to getting IFTTT to flash your house lights, go wild.

Or, just leave it empty, totally up to you.

`NODE_ENV` and `ISLOCAL` don't really do anything, but they're resevered for future use.

----
## Usage

This is a personal project, it's not supposed to be a foolproof webserver out there on the internet, there's like a million ways to screw this up, with that said, here's what you can do with it...

![breadcrumb trail](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/breadcrumb.png?token=GHSAT0AAAAAACBGWLNX7YQIZUHXQJ5BNGQIZB6QVTQ)

In the breadcrumb navigation `Home` will return you to the default SVG folder. Clicking `Select Directory` will give you a sub-directory list, pick one to drill down, click the breadcrumb to move back up. The UI will generally only display .svg files. (The ability to create new directories remotely has been removed from this version).

![Buttons](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/buttons.png?token=GHSAT0AAAAAACBGWLNW4CX4K7CMSQM5VSTCZB6QNUA)

`Sysinfo` & `Version` - will both show various bits of system information.

`Toggle` - sends a toggle command to the plotter, each time you turn the plotter on you _may_ need to do this a couple of times 🤷‍♂️

`Toggle Brushless` - if you have a brushless servo, use this one 'cause it needs to send the signal out on a differnent port thingy, it also uses a reduced pen height. If you're using springs on your brusnless servo you should _also_ toggle it down once you've finished, don't leave the spring compressed.

`Align` - Disengaged the motors so you're free to move the arm thingy around.

`Walk Home` - If you hit the pause button (a.k.a. the FM button) this will return the head back home. _WELL_ in theory, it'll return it to the last place the motors got engadged. I tend not to use this, but it's there on the rare occasions I want it.

`Upload` - Select your SVG and upload here, it'll upload into whichever directory is currently selected.

When you upload a file the UI will look something like this...

![Preview mode](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/preview.png?token=GHSAT0AAAAAACBGWLNWY3Z4N4MDWRX6B3HIZB6Q25Q)

If you've set a `WEBHOOK` in the `.env` file it'll show here, otherwise you can just add one if you want to (I generally don't, I'm only showing here as an example).

`Speed` - is how fast you want it to run, expressed as a percentage of maximum travel speed, within the range of 1 to 110. The default AxiDraw speed is 25, I tend to run a little slower at 20. The higher the faster your plot, but the worse your corners will be, use with care!

`Constant speed` - some pens work better with constant speed, some are fine with the weird acceleration. Plots can be quicker with this turned off, it all kinda depends on the design.

`Brushless servo` - you need to set this if you have a brushless servo to make sure the signal goes to the right place, also it changes the time estimate calculation.

`Preview` - once you've set all your stuff, hit this button and it'll run a preview plot. ***THIS MAY TAKE SEVERAL MINUTES*** if it's a complicated plot, the web server is basically waiting for the preview to finish, so it ***may look like** it's hung or crashed but just give it a minute more. You have to run a preview before you're allowed to plot, it's **the law**.

`Delete` - will delete the SVG file with NO WARNING (other than this one)

Once you've hit `Preview` you'll get something like this...

![Final view](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/final.png?token=GHSAT0AAAAAACBGWLNWXLZCUZ5IT46GE5NSZB6RE5A)

This will tell you how long it thinks to plot will take, the distance so we can all write those fancy descriptions on Instagram (you're welcome) and the time it thinks it'll finish. There is a chance this could be out a few minutes on a long plot.

The **Webhook** however will be fired by the axicli software itself not this server, so that'll happen when it's properly finished.

`Plot` - will start the plot - again if it's complicated this may take a couple of minutes to start.

![Progress](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/progress.png?token=GHSAT0AAAAAACBGWLNWFRSGMM6LJJW67F5EZB6RJUQ)

When the plot starts you'll see a progress bar, remaining time and end time.

This is based *purely* on the estimated preview time, it's not doing any fancy monitoring of the plotter itself. The page will refresh ever 5 seconds until the timer is up. If you stop the plot before then it has _no idea_. But you can just hit the `Plot` button again, or some other svg file to kick that off.

When the plot is finished, the webhook, if you set one will be triggered.

----
## Danger

While I'm pretty sure you can't break anything with this, is has, _once again_ been designed with the minimal error checking and specifically so I can send SVGs to to the plotter with minimal fuss.

As usual don't sent plots that are too big for the plotter itself, there's no area previewing the checking in this code, it's literally just sending the SVG file to the plotter.

If the plotter doesn't like the SVG it won't say anything, most likely the webserver will crash and you'll have to restart it.

***DO NOT*** use process manager tools (like PM2) to keep the webserver alive, always start it yourself with `npm start` (if this server is started as a 'child' of another process, which in turn spawns control of the AxiDraw in it's own child process then data will be sent in "chunks" rather than "smoothly" - trust me on this one).

----
## Contributing

Contributions to this project, suggestions and bug reports will be happily sent to `/dev/null` unless they're really good. Even though I have more than one plotter I'm not going to add the ability to control more than one machine any time soon.

Feel free to grab the code and go wild though.

----
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.