const addOp = initialVal => initialVal + 1
const minusOp = initialVal => initialVal - 1
const staySame = initialVal => initialVal
const stringifyCoordinates = (x, y) => `${x}${y}`
const parseCoordinates = coordinateString => ({
    x: parseInt(coordinateString[0]),
    y: parseInt(coordinateString[1])
})



class Chess {
    constructor () {
        this.setBlankBoard();
        this.applyLayout(this.generateDefaultLayout())
        this.DOMCreateBoard();
    }

    rows = 8
    columns = 8
    facingColor = 'white'
    oppositeColor = 'black'
    primaryBoardColor = 'white'
    secondaryBoardColor = 'blue'

    startingRows = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

    pinnedPieces = new Map()

    addToPinnedPieces (squareCoords, validMoves) {
        this.pinnedPieces.set(squareCoords, validMoves)
    }

    xrayingPieces = []

    setBlankBoard () {
        this.board = Array.from({ length: this.rows }, () => Array(this.columns).fill(null))
    }

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
 
    applyLayout (layout) {
        for (let i = 0; i < this.rows; ++i) {
            for (let j = 0; j < this.columns; ++j) {
                const coordString = stringifyCoordinates(i, j)
                if (layout[coordString]) this.board[i][j] = layout[coordString]
            }
        }
        this.updateMoves(Object.values(layout))
    }

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
        if ((!this.inCheckColor || this.inCheckColor === piece.color && ((this.checkBlockMoves?.has(newCoordinates) && piece.type !== 'king') || piece.type === 'king')) && piece.availableSquares.has(newCoordinates)) {
            document.getElementById(newCoordinates).replaceChildren(pieceDOMRef)
            const {x: newX, y: newY} = parseCoordinates(newCoordinates)
            piece.x = newX
            piece.y = newY
            this.board[newX][newY] = piece
            this.board[oldX][oldY] = null

            const effectedPieces = this.scanEffectedPiece([oldCoordinates, newCoordinates])

            this.pinnedPieces.forEach((_, pinnedPieceCoords) => {
                const {x: pinnedX, y: pinnedY} = parseCoordinates(pinnedPieceCoords)
                if (pinnedPieceCoords !== oldCoordinates && !effectedPieces.some(({x, y}) => pinnedX === x && pinnedY === y)) {
                    effectedPieces.push(this.board[pinnedX][pinnedY])
                }
            })

            this.xrayingPieces.forEach((xrayPiece) => {
                if (!effectedPieces.some(({x,y}) => xrayPiece.x === x && xrayPiece.y === y)) {
                    effectedPieces.push(xrayPiece)
                }
            })
            this.updateMoves(effectedPieces)
        } else {
            document.getElementById(oldCoordinates).append(pieceDOMRef)
        }
    }
    //instead of having x and y attri for piece obj, just combine them?
    //store references to pieces in a member array
    //when updating pieces, chain references together then remove from queue

    scanEffectedPiece (coordinates) {
        return this.board.reduce((accumulator, row) => (
            accumulator.concat(
                row.filter(piece => 
                    piece && 
                    (piece.type === 'king' ||
                    coordinates.some(coord => 
                        piece.availableSquares.has(coord) || 
                        piece.xraySquares.has(coord) ||
                        piece.blockedSquares.has(coord)
                    ))
                )
            )
        ), [])
    }

    updateMoves(pieces) {
        const kings = []
        this.pinnedPieces.clear()
        this.xrayingPieces = []
        this.inCheckColor = undefined
        this.checkBlockMoves = undefined

        pieces.forEach(piece => {
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
                    break;
                case 'king':
                    kings.push(piece)
            }
        })

        this.pinnedPieces.forEach((moves, coords) => {
            const {x, y} = parseCoordinates(coords)
            const piece = this.board[x][y]
            piece.availableSquares = new Set(
                moves.filter(move => piece.availableSquares.has(move))
            )
        })
          
        kings.forEach(king => this.updateKingMoves(king))
    }
    
    updateIterativeMoves (piece) {
        const oppositeColor = piece.color === 'white' ? 'black' : 'white'
        let pieceToCauseXray;
        let trackMoves = []
        const resetTrackingFields = () => {
            pieceToCauseXray = undefined
            trackMoves = []
        }

        const iterate = (x, y, xOp, yOp, xray = false) => {
            const newX = xOp(x), newY = yOp(y);
            const nextSquare = this.board[newX] ? this.board[newX][newY] : undefined;
            if (nextSquare === null) {
                (xray ? piece.xraySquares : piece.availableSquares).add(stringifyCoordinates(newX, newY));
                trackMoves.push(stringifyCoordinates(newX, newY))
                iterate(newX, newY, xOp, yOp, xray);
            } else if (nextSquare?.color === oppositeColor) {
                if (xray) {
                    if (nextSquare.type === 'king') {
                        this.addToPinnedPieces(pieceToCauseXray, trackMoves.concat(stringifyCoordinates(piece.x, piece.y)))
                        this.xrayingPieces.push(piece)
                    }
                    piece.xraySquares.add(stringifyCoordinates(newX, newY))
                } else {
                    if (nextSquare.type === 'king') {
                        this.inCheckColor = oppositeColor
                        this.checkBlockMoves = new Set(trackMoves)
                    }
                    piece.availableSquares.add(stringifyCoordinates(newX, newY))
                    pieceToCauseXray = stringifyCoordinates(newX, newY)
                    iterate(newX, newY, xOp, yOp, true);
                }
            } else if (nextSquare?.color === piece.color) {
                if (xray) {
                    piece.xraySquares.add(stringifyCoordinates(newX, newY))
                } else {
                    piece.blockedSquares.add(stringifyCoordinates(newX, newY))
                    pieceToCauseXray = stringifyCoordinates(newX, newY)
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
          if (boardSquare === null) {
            piece.availableSquares.add(stringifyCoordinates(x, y))
          } else if ( boardSquare?.color === oppositeColor) {
            if (boardSquare.type === 'king') {
                this.inCheckColor = oppositeColor
            }
            piece.availableSquares.add(stringifyCoordinates(x, y))
          } else if (boardSquare?.color === piece.color) {
            piece.blockedSquares.add(stringifyCoordinates(x, y));
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
                this.board[affect(2)][piece.y] ?
                    piece.blockedSquares.add(stringifyCoordinates(affect(2), piece.y)) :
                    piece.availableSquares.add(stringifyCoordinates(affect(2), piece.y))
            } 
            piece.availableSquares.add(stringifyCoordinates(oneForward, piece.y))
        }

        if (this.board[oneForward][piece.y + 1] !== undefined) {
            if (this.board[oneForward][piece.y + 1]?.color === oppositeColor) {
                if (this.board[oneForward][piece.y + 1].type === 'king') {
                    this.inCheckColor = oppositeColor
                }
                piece.availableSquares.add(stringifyCoordinates(oneForward, piece.y + 1))
            } else {
                piece.blockedSquares.add(stringifyCoordinates(oneForward, piece.y + 1))
            }                
        }

        if (this.board[oneForward][piece.y - 1] !== undefined) {
            if (this.board[oneForward][piece.y - 1]?.color === oppositeColor) {
                if (this.board[oneForward][piece.y - 1].type === 'king') {
                    this.inCheckColor = oppositeColor
                }
                piece.availableSquares.add(stringifyCoordinates(oneForward, piece.y - 1))
            } else {
                piece.blockedSquares.add(stringifyCoordinates(oneForward, piece.y - 1))
            }
        }    
    }

    updateKingMoves (piece) {
        const down = piece.x + 1, up = piece.x - 1, left = piece.y - 1, right = piece.y + 1
        const oppositeColor = piece.color === 'white' ? 'black' : 'white'
        let availableMoves = []

        const findKingMoves = (x, y) => {
          const boardSquare = this.board[x] ? this.board[x][y] : undefined;
          if (boardSquare === null || boardSquare?.color === oppositeColor) {
            availableMoves.push(stringifyCoordinates(x, y))
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

        this.board.forEach(row => (
            row.forEach(checkPiece => {
                if (checkPiece?.color === oppositeColor) {
                    availableMoves = availableMoves.filter(move => !checkPiece.availableSquares.has(move) && !checkPiece.blockedSquares.has(move))
                }
            })
        ))
        piece.availableSquares = new Set(availableMoves)
    }

    onDrag (onDragEvent) {
        const target = onDragEvent.target
        target.ondragstart = () => false
        target.style.position = 'absolute';
        target.style.zIndex = 1000;
        target.style.cursor = 'grabbing'
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
        this.xraySquares = new Set();
        this.blockedSquares = new Set();
    }

    clearSets () {
        this.availableSquares.clear()
        this.xraySquares.clear()
        this.blockedSquares.clear();
    }
}

//TODO
//en passant
//pawn promotion
//king moves in check and check management
//castling