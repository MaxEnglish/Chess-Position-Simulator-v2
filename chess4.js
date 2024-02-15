const addOp = initialVal => initialVal + 1
const minusOp = initialVal => initialVal - 1
const staySame = initialVal => initialVal
const stringifyCoordinates = (x, y) => `${x}${y}`
const parseCoordinates = coordinateString => ({
    x: parseInt(coordinateString[0]),
    y: parseInt(coordinateString[1])
})

const addAvailableMovesToBoard = (availableMoves, pawnMoves) => {
    availableMoves.forEach(move => document.getElementById(move).classList.add('circle-backing'))
    pawnMoves?.forEach(move => document.getElementById(move).classList.add('circle-backing'))
}

const removeHighlights = () => document.querySelectorAll('.circle-backing').forEach(highlight => highlight.classList.remove('circle-backing'))

class Chess4 {

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
    turn = 'white'

    whitePieceRefs = []
    blackPieceRefs = []

    pinnedPieces = []
    checkBlockMoves = []
    checkingPieces = []
    enPassantMoves = new Map()

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

    //TODO
    //add to github repo
    //click move instead of drag and drop
    //en passant
    //promotion
    //customize style
    //show captured pieces
    //show whose turn it is
    //highlight the selected piece differently
    //highlight king when in check
    //custom board setup
    //flip the board
    //piece equality instead of using coordinates
    //notTurn instead of handling colors in update fns
    //don't hold file in pieces. Instead hold stringify coords version of coords

    movePiece (oldCoordinates, newCoordinates, pieceDOMRef) {
        const {x: oldX, y: oldY} = parseCoordinates(oldCoordinates)
        const piece = this.board[oldX][oldY]

        if (piece.color === this.turn && (piece.availableSquares.has(newCoordinates) || piece.pawnMoves?.has(newCoordinates))) {
            
            document.getElementById(newCoordinates).replaceChildren(pieceDOMRef)
            removeHighlights()

            if (piece.enPassantMove === newCoordinates) {
                const mutatedArr = piece.color === 'white' ? this.blackPieceRefs : this.whitePieceRefs
                mutatedArr.splice(mutatedArr.indexOf(piece.enPassantPieceRef), 1)
                document.getElementById(stringifyCoordinates(piece.enPassantPieceRef.x, piece.enPassantPieceRef.y)).replaceChildren()
                this.board[piece.enPassantPieceRef.x][piece.enPassantPieceRef.y] = null
            }

            const {x: newX, y: newY} = parseCoordinates(newCoordinates)
            piece.x = newX
            piece.y = newY
            //when capturing a piece, remove from piece reference array
            if (this.board[newX][newY]) {
                const mutatedArr = piece.color === 'white' ? this.blackPieceRefs : this.whitePieceRefs
                mutatedArr.splice(mutatedArr.indexOf(this.board[newX][newY]), 1)
            }

            this.board[newX][newY] = piece
            this.board[oldX][oldY] = null

            this.resetTrackers()

            if (piece.type === 'pawn' && Math.abs(oldX - newX) === 2) {
                const leftSquare = this.board[piece.x][piece.y - 1]
                const rightSquare = this.board[piece.x][piece.y + 1]
                console.log(leftSquare, rightSquare)
                if (leftSquare?.type === 'pawn' && leftSquare.color !== piece.color) {
                    console.log('trigger1')
                    const direction = piece.color === this.facingColor ? 1 : -1
                    leftSquare.updateNextCycle = true
                    this.enPassantMoves.set(stringifyCoordinates(leftSquare.x, leftSquare.y), [stringifyCoordinates(piece.x + direction, piece.y), piece])
                    console.log(this.enPassantMoves)
                }
                if (rightSquare?.type === 'pawn' && rightSquare.color !== piece.color) {
                    console.log('trigger2')
                    const direction = piece.color === this.facingColor ? 1 : -1
                    rightSquare.updateNextCycle = true
                    this.enPassantMoves.set(stringifyCoordinates(rightSquare.x, rightSquare.y), [stringifyCoordinates(piece.x + direction, piece.y), piece])
                    console.log(this.enPassantMoves)
                }
            }

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
                pinnedPiece.availableSquares = new Set(validMoves.filter(move => pinnedPiece.availableSquares.has(move)))
                if (pinnedPiece.type === 'pawn') pinnedPiece.pawnMoves = new Set(validMoves.filter(move => pinnedPiece.pawnMoves.has(move)))
            })

            this.adjustKingSquares()

            if (this.inCheck) {
                this.adjustForCheck()
            }
            this.turn = this.turn === 'white' ? 'black' : 'white'
            //this.notTurn = this.notTurn === 'white' ? 'black' : 'white' 

        } else {
            document.getElementById(oldCoordinates).append(pieceDOMRef)
        }
    }

    adjustKingSquares () {
        const isWhiteTurn = this.turn === 'white'
        const thisTurnPieces = isWhiteTurn ? this.whitePieceRefs : this.blackPieceRefs
        const thisTurnKing = isWhiteTurn ? this.whiteKingRef : this.blackKingRef
        const oppositeKing = isWhiteTurn ? this.blackKingRef : this.whiteKingRef

        thisTurnPieces.forEach(piece => {
            piece.availableSquares.forEach(square => oppositeKing.availableSquares.delete(square))
            piece.blockedSquares.forEach(square => oppositeKing.availableSquares.delete(square))
        })

        this.checkingPieces.forEach(piece => piece.xraySquares.forEach(square => oppositeKing.availableSquares.delete(square)))
        
        thisTurnKing.availableSquares.forEach(square => oppositeKing.availableSquares.delete(square))
    }

    adjustForCheck () {
        let numAvailableMoves = 0
        const inCheckPieces = this.turn === 'white' ? this.blackPieceRefs : this.whitePieceRefs;

        inCheckPieces.forEach(piece => {
            piece.availableSquares = new Set(this.checkBlockMoves.filter(move => piece.availableSquares.has(move)))
            if (piece.type === 'pawn') piece.pawnMoves = new Set(this.checkBlockMoves.filter(move => piece.pawnMoves.has(move)))

            numAvailableMoves += piece.availableSquares.size + (piece.pawnMoves?.size ?? 0)
            piece.updateNextCycle = true
        })
        
        const inCheckKing = this.turn === 'white' ? this.blackKingRef : this.whiteKingRef
        if (numAvailableMoves + inCheckKing.availableSquares.size === 0) {
            console.log('CHECKMATE!')
        }
    }

    updatePieces (pieceRefArr, oldCoords, newCoords, isSetup) {
        pieceRefArr.forEach(piece => {
            if (isSetup || piece.setHasCoords(oldCoords, newCoords)) {
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

    putInCheck (moves, pieceRef) {
        if (this.checkBlockMoves.length > 0) {
            this.checkBlockMoves = []
        } else {
            this.checkBlockMoves = [...moves]
            this.inCheck = true
        }
        if (pieceRef) this.checkingPieces.push(pieceRef)
    }

    resetTrackers () {
        this.pinnedPieces = []
        this.checkBlockMoves = []
        this.checkingPieces = []
        this.enPassantMoves.clear()
        this.inCheck = false
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
                }
                trackMoves.push(stringifiedCoordinates)
                iterate(newX, newY, xOp, yOp, xray);
            } else if (nextSquare?.color === oppositeColor) {
                if (xray) {
                    if (nextSquare.type === 'king' && pieceToCauseXray.color === oppositeColor) {
                        this.pinnedPieces.push([pieceToCauseXray, trackMoves.concat(stringifyCoordinates(piece.x, piece.y))])
                        piece.updateNextCycle = true
                        pieceToCauseXray.updateNextCycle = true
                    } 
                    piece.xraySquares.add(stringifiedCoordinates)
                } else {
                    piece.availableSquares.add(stringifiedCoordinates)
                    if (nextSquare.type === 'king') {
                        this.putInCheck(trackMoves.concat(stringifyCoordinates(piece.x, piece.y)), piece)
                    } else {
                        pieceToCauseXray = nextSquare
                    }
                    iterate(newX, newY, xOp, yOp, true)
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
          } else if (boardSquare?.color === oppositeColor) {
            if (boardSquare.type === 'king') {
                this.putInCheck([stringifyCoordinates(piece.x, piece.y)])
            }
            piece.availableSquares.add(stringifiedCoordinates)
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
            piece.pawnBlockedSquare = stringifyCoordinates(oneForward, piece.y)
        } else { 
            if (piece.x === moveTwoRowNum) { 
                if (this.board[affect(2)][piece.y]) {
                    piece.pawnBlockedSquare = stringifyCoordinates(affect(2), piece.y)
                } else {
                    piece.pawnMoves.add(stringifyCoordinates(affect(2), piece.y))
                }
            } 
            piece.pawnMoves.add(stringifyCoordinates(oneForward, piece.y))
        }

        const checkCaptureSquares = (yCoord) => {
            if (this.board[oneForward][yCoord] !== undefined) {
                if (this.board[oneForward][yCoord]?.color === oppositeColor) {
                    if (this.board[oneForward][yCoord].type === 'king') {
                        this.putInCheck([stringifyCoordinates(piece.x, piece.y)])
                    }
                    piece.availableSquares.add(stringifyCoordinates(oneForward, yCoord))
                } else {
                    piece.blockedSquares.add(stringifyCoordinates(oneForward, yCoord))
                }  
            }    
        }

        checkCaptureSquares(piece.y + 1)
        checkCaptureSquares(piece.y - 1)  

        const enPassantMove = this.enPassantMoves.get(stringifyCoordinates(piece.x, piece.y))
        if (enPassantMove) {
            console.log(this.enPassantMoves)
            piece.pawnMoves.add(enPassantMove[0])
            piece.enPassantMove = enPassantMove[0]
            piece.enPassantPieceRef = enPassantMove[1]
            piece.updateNextCycle = true
        }
    }

    updateKingMoves (piece) {
        piece.clearSets()
        const down = piece.x + 1, 
        up = piece.x - 1, 
        left = piece.y - 1, 
        right = piece.y + 1

        const oppositeColor = piece.color === 'white' ? 'black' : 'white'

        const findKingMoves = (x, y) => {
          const boardSquare = this.board[x] ? this.board[x][y] : undefined;
          if (boardSquare === null || boardSquare?.color === oppositeColor) {
            piece.availableSquares.add(stringifyCoordinates(x,y))
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
        boardElement.id = 'board'
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
                    pieceElement.onmousedown = (e) => {
                        e.target.ondragstart = () => false
                        if (square.color !== this.turn) return;
                        removeHighlights()
                        if (this.highlightedCoordinate === stringifyCoordinates(square.x,square.y)) {
                            this.highlightedCoordinate = undefined
                        } else {
                            addAvailableMovesToBoard(square.availableSquares, square.pawnMoves)
                            this.highlightedCoordinate = stringifyCoordinates(square.x, square.y)
                        }
                        this.onDrag(e)
                    }
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
        target.style.position = 'absolute';
        target.style.zIndex = 3;
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
            target.style.zIndex = 1;
            const newParents = document.elementsFromPoint(muPX, muPY)
            let found
            for (const parent of newParents) {
                const id = parent.id
                if (!id || id === 'board') continue
                this.movePiece(initialParent.id, id, target)
                found = true
                break;
            }
            if (!found) {
                initialParent.append(target)
            }
            document.removeEventListener('mousemove', onMouseMove);
            target.onmouseup = null;
            target.style.cursor = 'grab'
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
        if (type === 'pawn') {
            this.pawnMoves = new Set()
            //en passant
        }
        this.updateNextCycle = false
    }

    clearSets () {
        this.availableSquares.clear()
        this.blockedSquares.clear()
        this.xraySquares?.clear()
        this.pawnMoves?.clear();
        this.updateNextCycle = false
        if (this.type === 'pawn') {
            this.pawnBlockedSquare = undefined
            this.enPassantMove = undefined
            this.enPassantPieceRef = undefined
        }
    }

    setHasCoords (coord1, coord2) {
        return this.updateNextCycle || 
        this.availableSquares.has(coord1) || 
        this.blockedSquares.has(coord1) || 
        this.availableSquares.has(coord2) || 
        this.blockedSquares.has(coord2) || 
        this.xraySquares?.has(coord1) || 
        this.xraySquares?.has(coord2) ||
        this.pawnMoves?.has(coord1) ||
        this.pawnMoves?.has(coord2) ||
        this.pawnBlockedSquare === coord1 ||
        this.pawnBlockedSquare === coord2
    }
}