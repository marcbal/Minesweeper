# Minesweeper JS

A minesweeper made in native JavaScript, with an integrated solver.

## How to play

### Online

[mines.mbaloup.fr](https://mines.mbaloup.fr/)

### Self hosted (docker)
```bash
docker run -d -p 8080:80 marcbal/minesweeper:latest
```

## TODO

* Save score, locally in the browser (do not valid score if any help option is activated at any time during the game).
* Auto-zoom the grid based on the grid dimensions and the size of the window. Makes the cells stays square.
