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

const promotionPieceTypes = ['queen', 'rook', 'knight', 'bishop']

class Chess5 {

    constructor () {
        this.setBoard(this.generateDefaultLayout())
        this.DOMCreateBoard();
    }
    //player color
    rows = 8
    columns = 8
    facingColor = 'white'
    oppositeColor = 'black'
    turn = 'white'

    //board styling
    primaryBoardColor = 'white'
    secondaryBoardColor = 'blue'

    //piece reference array
    whitePieceRefs = []
    blackPieceRefs = []

    pinnedPieces = []
    checkBlockMoves = []
    checkingPieces = []
    enPassantMoves = new Map()

    //create board class member based on a pattern
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
        /*this.updateMoves(this.whitePieceRefs.concat(this.blackPieceRefs), 0, 0, true)
        this.updateKingMoves(this.whiteKingRef)
        this.updateKingMoves(this.blackKingRef)*/
        this.updatePieces(0,0,true)
    }
    
    startingRows = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

    //creates pattern for default chess position
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

    //impromptu add piece to the board
    addPieceToBoard (piece) {
        const pieceRefArr = piece.color === 'white' ? this.whitePieceRefs : this.blackPieceRefs

        pieceRefArr.push(piece)
        this.board[piece.x][piece.y] = piece

        this.resetTrackers()
        this.updatePieces(stringifyCoordinates(piece.x, piece.y))
    }

    //update pieces on board based on changing coordinates. To update all pieces at once, set setup to true
    updatePieces (oldCoordinates, newCoordinates, setup) {
        this.updateKingMoves(this.blackKingRef)
        this.updateMoves(this.whitePieceRefs, oldCoordinates, newCoordinates, setup)

        this.updateKingMoves(this.whiteKingRef)
        this.updateMoves(this.blackPieceRefs, oldCoordinates, newCoordinates, setup)

        this.adjustPinnedPieceMoves();
        this.adjustKingSquares()

        if (this.updateNextCyclePiece) {
            this.updateNextCyclePiece.updateNextCycle = true
        }

        if (this.inCheck) {
            this.adjustForCheck()
        }
    }

    //TODO
    //click move instead of drag and drop
    //promotion
    //castling
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
    //have a "setup" mode. In setup mode, have proxy board which gets updated. On save, set real board to proxy board and delete proxy. On cancel, revert to real board
    //in setup mode, can move pieces without restrictions

    //update board after moving a piece
    movePiece (oldCoordinates, newCoordinates, pieceDOMRef) {
        const {x: oldX, y: oldY} = parseCoordinates(oldCoordinates)
        const {x: newX, y: newY} = parseCoordinates(newCoordinates)
        const piece = this.board[oldX][oldY]

        if (piece.color === this.turn && (piece.availableSquares.has(newCoordinates) || piece.pawnMoves?.has(newCoordinates))) {
            //check if promoting piece
            if (piece.type === 'pawn' && (newX === 0 || newX === this.rows - 1)) {
                this.handlePromotion(oldCoordinates, newCoordinates, piece, pieceDOMRef)
                return;
            }
        
            //put piece into DOM
            pieceDOMRef.style.position = 'static'
            document.getElementById(newCoordinates).replaceChildren(pieceDOMRef)
            //remove any highlights
            removeHighlights()
            //if en passant move played, remove piece from DOM, ref array, and board member
            if (piece.enPassantMove === newCoordinates) {
                this.adjustEnPassant(piece)
            }
            
            piece.x = newX
            piece.y = newY

            //if capturing a piece, remove captured piece from piece reference array
            if (this.board[newX][newY]) {
                this.removeFromReferenceArray(this.board[newX][newY])
            }

            this.board[newX][newY] = piece
            this.board[oldX][oldY] = null

            this.resetTrackers()

            //if move meets criteria, give en passant moves to pawns
            if (piece.type === 'pawn' && Math.abs(oldX - newX) === 2) {
                this.assignEnPassantMoves(piece)
            }
 
            //update the pieces which aren't the piece being moved
            this.updatePieces(oldCoordinates, newCoordinates)

            this.passTurn()
        } else {
            pieceDOMRef.style.position = 'static'
            document.getElementById(oldCoordinates).append(pieceDOMRef)
        }
    }

    passTurn () {
        this.turn = this.turn === 'white' ? 'black' : 'white'
    }

    //remove moves from pinned pieces
    adjustPinnedPieceMoves () {
        this.pinnedPieces.forEach(([pinnedPiece, validMoves]) => {
            pinnedPiece.availableSquares = new Set(validMoves.filter(move => pinnedPiece.availableSquares.has(move)))
            if (pinnedPiece.type === 'pawn') pinnedPiece.pawnMoves = new Set(validMoves.filter(move => pinnedPiece.pawnMoves.has(move)))
        })
    }

    //give pawns ability to en passant if applicable
    assignEnPassantMoves (piece) {
        const leftSquare = this.board[piece.x][piece.y - 1]
        const rightSquare = this.board[piece.x][piece.y + 1]
        if (leftSquare?.type === 'pawn' && leftSquare.color !== piece.color) {
            const direction = piece.color === this.facingColor ? 1 : -1
            leftSquare.updateNextCycle = true
            this.enPassantMoves.set(stringifyCoordinates(leftSquare.x, leftSquare.y), [stringifyCoordinates(piece.x + direction, piece.y), piece])
        }
        if (rightSquare?.type === 'pawn' && rightSquare.color !== piece.color) {
            const direction = piece.color === this.facingColor ? 1 : -1
            rightSquare.updateNextCycle = true
            this.enPassantMoves.set(stringifyCoordinates(rightSquare.x, rightSquare.y), [stringifyCoordinates(piece.x + direction, piece.y), piece])
        }
    }

    //takes a piece reference and removes from reference array
    removeFromReferenceArray (piece) {
        const mutatedArr = piece.color === 'white' ? this.whitePieceRefs : this.blackPieceRefs
        mutatedArr.splice(mutatedArr.indexOf(piece), 1)
    }

    //if a piece is taken by en passant, adjust class members and DOM accordingly
    adjustEnPassant (piece) {
        this.removeFromReferenceArray(piece.enPassantPieceRef)
        document.getElementById(stringifyCoordinates(piece.enPassantPieceRef.x, piece.enPassantPieceRef.y)).replaceChildren()
        this.board[piece.enPassantPieceRef.x][piece.enPassantPieceRef.y] = null
    }

    //adjust king moves of player's king whose turn it is
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

    //remove all unviable moves from pieces when player is in check
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

    //check if piece needs to be updated and calls proper method
    updateMoves (pieceRefArr, oldCoords, newCoords, isSetup) {
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

    //update the check members
    putInCheck (moves, pieceRef) {
        if (this.checkBlockMoves.length > 0) {
            this.checkBlockMoves = []
        } else {
            this.checkBlockMoves = [...moves]
            this.inCheck = true
        }
        if (pieceRef) this.checkingPieces.push(pieceRef)
    }

    //reset fields
    resetTrackers () {
        this.pinnedPieces = []
        this.checkBlockMoves = []
        this.checkingPieces = []
        this.enPassantMoves.clear()
        this.inCheck = false
        this.updateNextCyclePiece = undefined
    }

    //update bishop/rook/queen moves
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
                        this.updateNextCyclePiece = pieceToCauseXray
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

    //update knight moves
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

    //update pawn moves
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
            piece.pawnMoves.add(enPassantMove[0])
            piece.enPassantMove = enPassantMove[0]
            piece.enPassantPieceRef = enPassantMove[1]
            piece.updateNextCycle = true
        }
    }

    //update king moves
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


    //DOM MANIP//

    //creates board on DOM using board member
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
                    pieceElement.src = `./pieces/${square.color}_${square.type}.png`
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

    //drag piece handler
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
            target.style.zIndex = 1;
            const newParents = document.elementsFromPoint(muPX, muPY)
            let found
            for (const {id} of newParents) {
                if (!id || id === 'board') continue
                this.movePiece(initialParent.id, id, target)
                found = true
                break;
            }
            if (!found) {
                target.style.position = 'static'
                initialParent.append(target)
            }
            document.removeEventListener('mousemove', onMouseMove);
            target.onmouseup = null;
            target.style.cursor = 'grab'
        }
    }

    handlePromotion (oldCoordinates, newCoordinates, piece, pieceDOMRef) {
        const promotionContainer = document.createElement('div')
        const {right, top} = pieceDOMRef.getBoundingClientRect()
        promotionContainer.style.right = right + 100 + 'px'
        promotionContainer.style.top = top + 'px'
        promotionContainer.className = 'promotion-container'

        const handleClickOff = (clickEvent) => {
            if (!document.elementsFromPoint(clickEvent.pageX, clickEvent.pageY).includes(promotionContainer)) {
                promotionContainer.remove()
                pieceDOMRef.style.position = 'static'
                document.getElementById(oldCoordinates).append(pieceDOMRef)
                document.removeEventListener('click', handleClickOff)
            }
        }

        document.addEventListener('click', handleClickOff)

        promotionPieceTypes.forEach(pieceType => {
            const promotionPiece = document.createElement('img')
            promotionPiece.src = `pieces/${piece.color}_${pieceType}.png`
            promotionPiece.className = 'promotion-piece'
            promotionPiece.onclick = () => {
                const {x: newX, y: newY} = parseCoordinates(newCoordinates)
                const {x: oldX, y: oldY} = parseCoordinates(oldCoordinates)
                piece.promote(pieceType)
                pieceDOMRef.src = `./pieces/${piece.color}_${pieceType}.png`
                pieceDOMRef.style.position = 'static'
                document.getElementById(newCoordinates).replaceChildren(pieceDOMRef)
                piece.x = newX
                piece.y = newY
                this.board[newX][newY] = piece
                this.board[oldX][oldY] = null
                this.updatePieces(oldCoordinates, newCoordinates)
                removeHighlights();
                promotionContainer.remove()
                document.removeEventListener('click', handleClickOff)
                this.passTurn();
            }
            promotionContainer.append(promotionPiece)
        })
    
        //need to append in specific location
        document.body.append(promotionContainer)
    }

}

const isIterativePiece = (type) => type === 'queen' || type === 'rook' || type === 'bishop'

class Piece {
    constructor (color, type, x, y) {
        this.color = color;
        this.type = type;
        this.x = x;
        this.y = y;
        this.availableSquares = new Set();
        this.blockedSquares = new Set();
        if (isIterativePiece(type)) {
            this.xraySquares = new Set()
        }
        if (type === 'pawn') { 
            this.pawnMoves = new Set()
            this.promote = (type) => {
                this.type = type
                if (isIterativePiece(type)) {
                    this.xraySquares = new Set()
                }
                delete this.pawnMoves
                delete this.pawnBlockedSquare
                delete this.enPassantMove
                delete this.enPassantPieceRef
                delete this.promote
            }
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