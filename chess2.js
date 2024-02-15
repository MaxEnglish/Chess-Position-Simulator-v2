const addOp = initialVal => initialVal + 1
const minusOp = initialVal => initialVal - 1
const staySame = initialVal => initialVal
const stringifyCoordinates = (x, y) => `${x}${y}`
const parseCoordinates = coordinateString => ({
    x: parseInt(coordinateString[0]),
    y: parseInt(coordinateString[1])
})

//add property to piece attribute that tells whether it should be updated next cycle
//make sure when updateNextCycle is getting applied is appropriate

//put yourself in check?
class Chess2 {

    constructor () {
        this.setBoard(this.generateDefaultLayout())
        this.DOMCreateBoard();
    }

    rows = 8
    columns = 8
    facingColor = 'white'
    oppositeColor = 'black'
    primaryBoardColor = 'white'
    secondaryBoardColor = 'blue'

    whitePieceRefs = []
    blackPieceRefs = []

    pinnedPieces = []
    checkBlockMoves = []

    setBoard (pattern) {
        const board = []
        for (let i = 0; i < this.rows; ++i) {
            const row = [];
            for (let j = 0; j < this.columns; ++j) {
                const stringifiedCoordinates = stringifyCoordinates(i,j)
                const piece = pattern[stringifiedCoordinates]
                if (piece) {
                    row.push(piece)
                    piece.color === 'white' ?
                        (piece.type === 'king' ? 
                            this.whiteKingRef = piece : 
                            this.whitePieceRefs.push(piece)) :
                        (piece.type === 'king' ? 
                            this.blackKingRef = piece : 
                            this.blackPieceRefs.push(piece))
                } else {
                    row.push(null)
                }
            }
            board.push(row)
        }

        this.board = board
        this.updatePieces(this.whitePieceRefs.concat(this.blackPieceRefs), 0, 0, true)
        this.updateKingMoves(this.whiteKingRef)
        this.updateKingMoves(this.blackKingRef)
    }
    
    startingRows = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

    generateDefaultLayout () {
        const layout = {}
        for (let i = 0; i < this.rows; ++i) {
            layout[`0${i}`] = new Piece(this.oppositeColor, this.startingRows[i], 0, i)
        }
        for (let i = 0; i < this.rows; ++i) {
            layout[`1${i}`] = new Piece(this.oppositeColor, 'pawn', 1, i)
        }
        for (let i = 0; i < this.rows; ++i) {
            layout[`6${i}`] = new Piece(this.facingColor, 'pawn', 6, i)
        }
        for (let i = 0; i < this.rows; ++i) {
            layout[`7${i}`] = new Piece(this.facingColor, this.startingRows[i], 7, i)
        }
        return layout
    }

    movePiece (oldCoordinates, newCoordinates, pieceDOMRef) {
        const {x: oldX, y: oldY} = parseCoordinates(oldCoordinates)
        const piece = this.board[oldX][oldY]
        if (piece.availableSquares.has(newCoordinates)) {
            document.getElementById(newCoordinates).replaceChildren(pieceDOMRef)
            const {x: newX, y: newY} = parseCoordinates(newCoordinates)
            piece.x = newX
            piece.y = newY
            this.board[newX][newY] = piece
            this.board[oldX][oldY] = null

            this.resetTrackers()

            //update black king moves
            this.updateKingMoves(this.blackKingRef)

            //update black pieces
            this.updatePieces(this.whitePieceRefs, oldCoordinates, newCoordinates)

            //update white king moves
            this.updateKingMoves(this.whiteKingRef)

            //update white pieces
            this.updatePieces(this.blackPieceRefs, oldCoordinates, newCoordinates)

            //if pinned piece, restrict moves
            this.pinnedPieces.forEach(([pinnedPiece, validMoves]) => {
                //might be able to improve this by looping through available moves set instead of validMoves
                pinnedPiece.availableSquares = new Set(validMoves.filter(move => pinnedPiece.availableSquares.has(move)))
            })

            //if in check, modify the valid moves
            if (this.inCheckColor) {
                if (this.multiCheck) this.checkBlockMoves = []
                let numAvailableMoves = 0
                const inCheckColorPieces = this.inCheckColor === 'white' ? this.whitePieceRefs : this.blackPieceRefs
                inCheckColorPieces.forEach(piece => {
                    piece.availableSquares = new Set(this.checkBlockMoves.filter(move => piece.availableSquares.has(move)))
                    numAvailableMoves += piece.availableSquares.size
                    piece.updateNextCycle = true
                })
                console.log(this.whiteKingRef)
                if (numAvailableMoves + (this.inCheckColor === 'white' ? this.whiteKingRef : this.blackKingRef).availableSquares.size === 0) {
                    console.log('CHECKMATE!')
                }
            }
        } else {
            document.getElementById(oldCoordinates).append(pieceDOMRef)
        }
    }

    updatePieces (pieceRefArr, oldCoords, newCoords, isSetup) {

        //needs to be a for of loop
        pieceRefArr.forEach(piece => {
            if (isSetup || piece.setHasCoords(oldCoords, newCoords)) {
                console.log(piece)
                piece.clearSets()
                switch(piece.type) {
                    case 'bishop':
                    case 'rook':
                    case 'queen':
                       this.updateIterativeMoves(piece)
                       break;
                    case 'pawn':
                        this.updatePawnMoves(piece)
                        break;
                    case 'knight':
                        this.updateKnightMoves(piece)
                }
            }
        })
    }


    removeFromKingMoves (kingColor, coord) {
        kingColor === 'white' ?
            this.whiteKingRef.availableSquares.delete(coord) :
            this.blackKingRef.availableSquares.delete(coord)
    }

    putInCheck (inCheckColor, moves) {
        if (this.checkBlockMoves.length > 0) {
            this.multiCheck = true
        } else {
            this.checkBlockMoves = moves
            this.inCheckColor = inCheckColor
        }
    }

    resetTrackers () {
        this.pinnedPieces = []
        this.checkBlockMoves = []
        this.inCheckColor = undefined
        this.multiCheck = false
    }

    updateIterativeMoves (piece) {
        const oppositeColor = piece.color === 'white' ? 'black' : 'white'
        let pieceToCauseXray, trackMoves = []
        const resetTrackingFields = () => {
            pieceToCauseXray = undefined
            trackMoves = []
        }

        const iterate = (x, y, xOp, yOp, xray = false) => {
            const newX = xOp(x), newY = yOp(y);
            const stringifiedCoordinates = stringifyCoordinates(newX, newY)
            const nextSquare = this.board[newX] ? this.board[newX][newY] : undefined;
            if (nextSquare === null) {
                if (xray) {
                    piece.xraySquares.add(stringifiedCoordinates)
                } else {
                    piece.availableSquares.add(stringifiedCoordinates)
                    this.removeFromKingMoves(oppositeColor, stringifiedCoordinates)
                }
                trackMoves.push(stringifiedCoordinates)
                iterate(newX, newY, xOp, yOp, xray);
            } else if (nextSquare?.color === oppositeColor) {
                if (xray) {
                    if (nextSquare.type === 'king') {
                        this.pinnedPieces.push([pieceToCauseXray, trackMoves.concat(stringifyCoordinates(piece.x, piece.y))])
                        piece.updateEveryCycle = true
                    } else {
                        piece.updateEveryCycle = false
                    }
                    piece.xraySquares.add(stringifiedCoordinates)
                } else {
                    piece.availableSquares.add(stringifiedCoordinates)
                    this.removeFromKingMoves(oppositeColor, stringifiedCoordinates)
                    if (nextSquare.type === 'king') {
                        this.putInCheck(oppositeColor, trackMoves)
                    } else {
                        pieceToCauseXray = nextSquare
                        iterate(newX, newY, xOp, yOp, true)
                    }
                }
            } else if (nextSquare?.color === piece.color) {
                if (xray) {
                    piece.xraySquares.add(stringifiedCoordinates)
                } else {
                    piece.blockedSquares.add(stringifiedCoordinates)
                    pieceToCauseXray = nextSquare
                    iterate(newX, newY, xOp, yOp, true);
                }
            }
        }
        if (piece.type === 'bishop' || piece.type === 'queen') {
            iterate(piece.x, piece.y, addOp, addOp);
            resetTrackingFields()
            iterate(piece.x, piece.y, minusOp, minusOp);
            resetTrackingFields()
            iterate(piece.x, piece.y, addOp, minusOp);
            resetTrackingFields()
            iterate(piece.x, piece.y, minusOp, addOp);
            resetTrackingFields()
        }
        if (piece.type === 'rook' || piece.type === 'queen') {
            iterate(piece.x, piece.y, addOp, staySame);
            resetTrackingFields()
            iterate(piece.x, piece.y, staySame, addOp);
            resetTrackingFields()
            iterate(piece.x, piece.y, minusOp, staySame);
            resetTrackingFields()
            iterate(piece.x, piece.y, staySame, minusOp);
        }
    }

    updateKnightMoves (piece) {
        const oppositeColor = piece.color === 'white' ? 'black' : 'white'

        const up2 = piece.x - 2, 
        down2 = piece.x + 2, 
        up1 = piece.x - 1, 
        down1 = piece.x + 1, 
        right2 = piece.y + 2, 
        left2 = piece.y - 2, 
        right1 = piece.y + 1, 
        left1 = piece.y - 1

        const findKnightMoves = (x, y) => {
          const boardSquare = this.board[x] ? this.board[x][y] : undefined;
          const stringifiedCoordinates = stringifyCoordinates(x,y)
          if (boardSquare === null) {
            piece.availableSquares.add(stringifiedCoordinates)
            this.removeFromKingMoves(oppositeColor, stringifiedCoordinates)
          } else if (boardSquare?.color === oppositeColor) {
            if (boardSquare.type === 'king') {
                this.putInCheck(oppositeColor, [stringifyCoordinates(piece.x, piece.y)])
            }
            piece.availableSquares.add(stringifiedCoordinates)
            this.removeFromKingMoves(oppositeColor, stringifiedCoordinates)
          } else if (boardSquare?.color === piece.color) {
            piece.blockedSquares.add(stringifiedCoordinates);
          }
        }
        findKnightMoves(up2, right1)
        findKnightMoves(up2, left1)
        findKnightMoves(down2, right1)
        findKnightMoves(down2, left1)
        findKnightMoves(up1, right2)
        findKnightMoves(up1, left2)
        findKnightMoves(down1, right2)
        findKnightMoves(down1, left2)
    }

    updatePawnMoves (piece) {
        const directionIsUp = piece.color === this.facingColor
        const oppositeColor = piece.color === 'white' ? 'black' : 'white'
        const affect = val => directionIsUp ? piece.x - val : piece.x + val 
        const oneForward = affect(1)
        const moveTwoRowNum = directionIsUp ? 6 : 1
        
        if (this.board[oneForward][piece.y]) { 
            piece.blockedSquares.add(stringifyCoordinates(oneForward, piece.y))
        } else { 
            if (piece.x === moveTwoRowNum) { 
                if (this.board[affect(2)][piece.y]) {
                    piece.blockedSquares.add(stringifyCoordinates(affect(2), piece.y))
                } else {
                    piece.availableSquares.add(stringifyCoordinates(affect(2), piece.y))
                    this.removeFromKingMoves(oppositeColor, stringifyCoordinates(affect(2), piece.y))
                }
            } 
            piece.availableSquares.add(stringifyCoordinates(oneForward, piece.y))
            this.removeFromKingMoves(oppositeColor, stringifyCoordinates(oneForward, piece.y))
        }

        const checkCaptureSquares = (yCoord) => {
            if (this.board[oneForward][yCoord] !== undefined) {
                if (this.board[oneForward][yCoord]?.color === oppositeColor) {
                    if (this.board[oneForward][yCoord].type === 'king') {
                        this.putInCheck(oppositeColor, [stringifyCoordinates(piece.x, piece.y)])
                    }
                    piece.availableSquares.add(stringifyCoordinates(oneForward, yCoord))
                    this.removeFromKingMoves(oppositeColor, stringifyCoordinates(oneForward, yCoord))
                } else {
                    piece.blockedSquares.add(stringifyCoordinates(oneForward, yCoord))
                }  
            }    
        }

        checkCaptureSquares(piece.y + 1)
        checkCaptureSquares(piece.y - 1)  
    }

    updateKingMoves (piece) {
        const down = piece.x + 1, 
        up = piece.x - 1, 
        left = piece.y - 1, 
        right = piece.y + 1

        const oppositeColor = piece.color === 'white' ? 'black' : 'white'

        const findKingMoves = (x, y) => {
          const boardSquare = this.board[x] ? this.board[x][y] : undefined;
          if (boardSquare === null || boardSquare?.color === oppositeColor) {
            piece.availableSquares.add(stringifyCoordinates(x,y))
            this.removeFromKingMoves(oppositeColor, stringifyCoordinates(x,y))
          } else if (boardSquare?.color === piece.color) {
            piece.blockedSquares.add(stringifyCoordinates(x, y))
          }
        }

        findKingMoves(up, piece.y)
        findKingMoves(up, left)
        findKingMoves(up, right)
        findKingMoves(down, piece.y)
        findKingMoves(down, left)
        findKingMoves(down, right)
        findKingMoves(piece.x, left)
        findKingMoves(piece.x, right)
    }


    //DOM MANIP

    DOMCreateBoard () {
        const boardElement = document.createElement('div')
        boardElement.className = 'board'
        this.board.forEach((row, rowIndex) => {
            const rowElement = document.createElement('div')
            rowElement.className = 'board-row'
            row.forEach((square, squareIndex) => {
                const squareElement = document.createElement('div')
                squareElement.className = 'board-square'
                squareElement.style.backgroundColor = (rowIndex + squareIndex) % 2 === 0 ? this.primaryBoardColor : this.secondaryBoardColor
                squareElement.id = stringifyCoordinates(rowIndex, squareIndex)
                if (square) {
                    const pieceElement = document.createElement('img')
                    pieceElement.src = `./pieces/${square.file}`
                    pieceElement.className = 'board-piece'
                    pieceElement.onmousedown = (e) => this.onDrag(e)
                    squareElement.append(pieceElement)
                }
                rowElement.append(squareElement)
            })
            boardElement.append(rowElement)
        })
        document.body.append(boardElement)
    }

    onDrag (onDragEvent) {
        const target = onDragEvent.target
        target.ondragstart = () => false
        target.style.position = 'absolute';
        target.style.zIndex = 1000;
        const initialParent = target.parentElement;
        
        document.body.append(target);

        const onMouseMove = ({pageX, pageY}) => {
            target.style.left = pageX - target.offsetWidth / 2 + 'px';
            target.style.top = pageY - target.offsetHeight / 2 + 'px';
        }

        onMouseMove(onDragEvent)
        
        document.addEventListener('mousemove', onMouseMove);

        target.onmouseup = ({pageX: muPX, pageY: muPY}) => {
            target.style.position = 'static'
            const newParents = document.elementsFromPoint(muPX, muPY)
            if (newParents[0].id) {
                this.movePiece(initialParent.id, newParents[0].id, target)
            } else if (newParents[1].id) {
                this.movePiece(initialParent.id, newParents[1].id, target)
            } else {
                initialParent.append(target)
            }
            document.removeEventListener('mousemove', onMouseMove);
            target.onmouseup = null;
        }
    }

}

class Piece {
    constructor (color, type, x, y) {
        this.color = color;
        this.type = type;
        this.file = `${color}_${type}.png`
        this.x = x;
        this.y = y;
        this.availableSquares = new Set();
        this.blockedSquares = new Set();
        if (type === 'bishop' || type === 'rook' || type === 'queen') {
            this.xraySquares = new Set()
        }
        this.updateNextCycle = false
    }

    clearSets () {
        this.availableSquares.clear()
        this.blockedSquares.clear()
        this.xraySquares?.clear()
        this.updateNextCycle = false
    }

    setHasCoords (coord1, coord2) {
        return this.updateEveryCycle ||  this.updateNextCycle || this.availableSquares.has(coord1) || this.blockedSquares.has(coord1) || this.availableSquares.has(coord2) || this.blockedSquares.has(coord2) || this.xraySquares?.has(coord1) || this.xraySquares?.has(coord2)
    }
}