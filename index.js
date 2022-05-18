
// Dibujando nuestro contenedor-:)-------

var canvas = document.getElementById("myCanvas");
var c = canvas.getContext("2d");
// Dimenciones
canvas.width = window.innerWidth - 40;
canvas.height = window.innerHeight - 110;

var flipperHeight = 2;
// Asignamos dimenciones para que este proporcionado
var cScale = canvas.height / flipperHeight;
var simWidth = canvas.width / cScale;
var simHeight = canvas.height / cScale;

function cX(pos) {
    return pos.x * cScale ;
}

function cY(pos) {
    return canvas.height - pos.y * cScale;
}

// vector math -------------------------------------------------------

class Vector2 {
    constructor(x = 0.0, y = 0.0) {
        this.x = x; 
        this.y = y;
    }

    set(v) {
        this.x = v.x; this.y = v.y;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v, s = 1.0) {
        this.x += v.x * s;
        this.y += v.y * s;
        return this;
    }

    addVectors(a, b) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        return this;
    }

    subtract(v, s = 1.0) {
        this.x -= v.x * s;
        this.y -= v.y * s;
        return this;
    }

    subtractVectors(a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        return this;			
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    scale(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    perp() {
        return new Vector2(-this.y, this.x);
    }
}

// ----------------------------------------------------------------------
function closestPointOnSegment(p, a, b) 
{
    var ab = new Vector2();
    ab.subtractVectors(b, a);
    var t = ab.dot(ab);
    if (t == 0.0)
        return a.clone();
    t = Math.max(0.0, Math.min(1.0, (p.dot(ab) - a.dot(ab)) / t));
    var closest = a.clone();
    return closest.add(ab, t);
}

// physics scene -------------------------------------------------------

class Ball {
    constructor(radius, mass, pos, vel, restitution) {
        this.radius = radius;
        this.mass = mass;
        this.restitution = restitution;
        this.pos = pos.clone();
        this.vel = vel.clone();
    }
    simulate(dt, gravity) {
        this.vel.add(gravity, dt);
        this.pos.add(this.vel, dt);
    }
}

class Obstacle {
    constructor(radius, pos, pushVel) {
        this.radius = radius;
        this.pos = pos.clone();
        this.pushVel = pushVel;
    }
}

class Flipper {
    constructor(radius, pos, length, restAngle, maxRotation, 
        angularVelocity, restitution) 
    {
        // fixed
        this.radius = radius;
        this.pos = pos.clone();
        this.length = length;
        this.restAngle = restAngle;
        this.maxRotation = Math.abs(maxRotation);
        this.sign = Math.sign(maxRotation);
        this.angularVelocity = angularVelocity;
        // changing
        this.rotation = 0.0;
        this.currentAngularVelocity = 0.0;
        this.touchIdentifier = -1;
    }
    simulate(dt) 
    {
        var prevRotation = this.rotation;
        var pressed = this.touchIdentifier >= 0;
        if (pressed) 
            this.rotation = Math.min(this.rotation + dt * this.angularVelocity, 
                this.maxRotation);
        else 
            this.rotation = Math.max(this.rotation - dt * this.angularVelocity, 
                0.0);
        this.currentAngularVelocity = this.sign * (this.rotation - prevRotation) / dt;
    }
    select(pos) {
        var d = new Vector2();
        d.subtractVectors(this.pos, pos);
        return d.length() < this.length;
    }
    getTip() 
    {
        var angle = this.restAngle + this.sign * this.rotation;
        var dir = new Vector2(Math.cos(angle), Math.sin(angle));
        var tip = this.pos.clone();
        return tip.add(dir, this.length);
    }
}

var physicsScene = 
{
    gravity : new Vector2(0.0, -3.0),
    dt : 1.0 / 60.0,
    score: 0,
    paused: true,
    border: [],
    balls: [],
    obstacles: [],
    flippers: []
};

function setupScene() 
{
    var offset = 0.02;
    physicsScene.score = 0;

    // border

    physicsScene.border.push(new Vector2(0.74, 0.25));
    physicsScene.border.push(new Vector2(1.0 - offset, 0.4));
    physicsScene.border.push(new Vector2(1.0 - offset, flipperHeight - offset));
    physicsScene.border.push(new Vector2(offset, flipperHeight - offset));
    physicsScene.border.push(new Vector2(offset, 0.4));
    physicsScene.border.push(new Vector2(0.26, 0.25));
    physicsScene.border.push(new Vector2(0.26, 0.0));
    physicsScene.border.push(new Vector2(0.74, 0.0));

    // ball

    {
        physicsScene.balls = [];

        var radius = 0.03;
        var mass = Math.PI * radius * radius;
        var pos = new Vector2(0.92,  0.5);
        var vel = new Vector2(-0.2, 3.5);
        physicsScene.balls.push(new Ball(radius, mass, pos, vel, 0.2));

        pos = new Vector2(0.08,  0.5);
        vel = new Vector2(0.2, 3.5);
        physicsScene.balls.push(new Ball(radius, mass, pos, vel, 0.2));
    }

    // Creamos los obstaculor asi como su localización por medio de las cordenadas

    {
        physicsScene.obstacles = [];
        var numObstacles = 5;

        physicsScene.obstacles.push(new Obstacle(0.1, new Vector2(0.25, 0.6), 2.0));
        physicsScene.obstacles.push(new Obstacle(0.1, new Vector2(0.75, 0.5), 2.0));
        physicsScene.obstacles.push(new Obstacle(0.12, new Vector2(0.7, 1.0), 2.0));
        physicsScene.obstacles.push(new Obstacle(0.1, new Vector2(0.2, 1.2), 2.0));
        physicsScene.obstacles.push(new Obstacle(0.11, new Vector2(0.5, 1.6), 2.0));

    }

    // Palancas, le damos sus dimencione,
    // su radio, rotación, posicion etc etc

    {
        var radius = 0.03;
        var length = 0.2;
        var maxRotation = 1.0;
        var restAngle = 0.5;
        var angularVelocity = 10.0;
        var restitution = 0.0;

        var pos1 = new Vector2(0.26, 0.22);
        var pos2 = new Vector2(0.74, 0.22);

        physicsScene.flippers.push(
            new Flipper(radius, pos1, length, 
                -restAngle, maxRotation, angularVelocity, restitution));
        physicsScene.flippers.push(
            new Flipper(radius, pos2, length, 
                Math.PI + restAngle, -maxRotation, angularVelocity, restitution));
    }
}

// draw -------------------------------------------------------

function drawDisc(x, y, radius)
{
    c.beginPath();			
    c.arc(
        x, y, radius, 0.0, 2.0 * Math.PI); 
    c.closePath();
    c.fill();
}

function draw() 
{
    c.clearRect(0, 0, canvas.width, canvas.height);

    // border

    if (physicsScene.border.length >= 2) {

        c.strokeStyle = "#000000";
        c.lineWidth = 5;

        c.beginPath();
        var v = physicsScene.border[0];
        c.moveTo(cX(v), cY(v));
        for (var i = 1; i < physicsScene.border.length + 1; i++) {
            v = physicsScene.border[i % physicsScene.border.length];
            c.lineTo(cX(v), cY(v));
        }
        c.stroke();	
        c.lineWidth = 1;
    }

    // balls

    c.fillStyle = "#202020";

    for (var i = 0; i < physicsScene.balls.length; i++) {
        var ball = physicsScene.balls[i];
        drawDisc(cX(ball.pos), cY(ball.pos), ball.radius * cScale);
    }

    // obstacles

    c.fillStyle = "#FF8000";

    for (var i = 0; i < physicsScene.obstacles.length; i++) {
        var obstacle = physicsScene.obstacles[i];
        drawDisc(cX(obstacle.pos), cY(obstacle.pos), obstacle.radius * cScale);
    }

    // flippers

    c.fillStyle = "#FF0000";

    for (var i = 0; i < physicsScene.flippers.length; i++) {
        var flipper = physicsScene.flippers[i];
        c.translate(cX(flipper.pos), cY(flipper.pos));
        c.rotate(-flipper.restAngle - flipper.sign * flipper.rotation);

        c.fillRect(0.0, -flipper.radius * cScale, 
            flipper.length * cScale, 2.0 * flipper.radius * cScale);
        drawDisc(0, 0, flipper.radius * cScale);
        drawDisc(flipper.length * cScale, 0, flipper.radius * cScale);
        c.resetTransform();				
    } 
}

// --- collision handling -------------------------------------------------------

function handleBallBallCollision(ball1, ball2) 
{
    var restitution = Math.min(ball1.restitution, ball2.restitution);
    var dir = new Vector2();
    dir.subtractVectors(ball2.pos, ball1.pos);
    var d = dir.length();
    if (d == 0.0 || d > ball1.radius + ball2.radius)
        return;

    dir.scale(1.0 / d);

    var corr = (ball1.radius + ball2.radius - d) / 2.0;
    ball1.pos.add(dir, -corr);
    ball2.pos.add(dir, corr);

    var v1 = ball1.vel.dot(dir);
    var v2 = ball2.vel.dot(dir);

    var m1 = ball1.mass;
    var m2 = ball2.mass;

    var newV1 = (m1 * v1 + m2 * v2 - m2 * (v1 - v2) * restitution) / (m1 + m2);
    var newV2 = (m1 * v1 + m2 * v2 - m1 * (v2 - v1) * restitution) / (m1 + m2);

    ball1.vel.add(dir, newV1 - v1);
    ball2.vel.add(dir, newV2 - v2);
}

// -----------------------------------------------------------------
function handleBallObstacleCollision(ball, obstacle) 
{
    var dir = new Vector2();
    dir.subtractVectors(ball.pos, obstacle.pos);
    var d = dir.length();
    if (d == 0.0 || d > ball.radius + obstacle.radius)
        return;

    dir.scale(1.0 / d);

    var corr = ball.radius + obstacle.radius - d;
    ball.pos.add(dir, corr);

    var v = ball.vel.dot(dir);
    ball.vel.add(dir, obstacle.pushVel - v);

    physicsScene.score++;
}

// ----------------------------------------------------------------
function handleBallFlipperCollision(ball, flipper) 
{
    var closest = closestPointOnSegment(ball.pos, flipper.pos, flipper.getTip());
    var dir = new Vector2();
    dir.subtractVectors(ball.pos, closest);
    var d = dir.length();
    if (d == 0.0 || d > ball.radius + flipper.radius)
        return;

    dir.scale(1.0 / d);

    var corr = (ball.radius + flipper.radius - d);
    ball.pos.add(dir, corr);

    // update velocitiy

    var radius = closest.clone();
    radius.add(dir, flipper.radius);
    radius.subtract(flipper.pos);
    var surfaceVel = radius.perp();
    surfaceVel.scale(flipper.currentAngularVelocity);

    var v = ball.vel.dot(dir);
    var vnew = surfaceVel.dot(dir);

    ball.vel.add(dir, vnew - v);
}

// ---------------------------------------------------------------------
function handleBallBorderCollision(ball, border) 
{
    if (border.length < 3)
        return;

    // find closest segment;

    var d = new Vector2();
    var closest = new Vector2();
    var ab = new Vector2();
    var normal;

    var minDist = 0.0;

    for (var i = 0; i < border.length; i++) {
        var a = border[i];
        var b = border[(i + 1) % border.length];
        var c = closestPointOnSegment(ball.pos, a, b);
        d.subtractVectors(ball.pos, c);
        var dist = d.length();
        if (i == 0 || dist < minDist) {
            minDist = dist;
            closest.set(c);
            ab.subtractVectors(b, a);
            normal = ab.perp();
        }
    }

    // push out
    d.subtractVectors(ball.pos, closest);
    var dist = d.length();
    if (dist == 0.0) {
        d.set(normal);
        dist = normal.length();
    }
    d.scale(1.0 / dist);

    if (d.dot(normal) >= 0.0) {
        if (dist > ball.radius) 
            return;
        ball.pos.add(d, ball.radius - dist);
    }
    else
        ball.pos.add(d, -(dist + ball.radius));

    // update velocity
    var v = ball.vel.dot(d);
    var vnew = Math.abs(v) * ball.restitution;

    ball.vel.add(d, vnew - v);
}

// simulation -------------------------------------------------------

function simulate() 
{
    for (var i = 0; i < physicsScene.flippers.length; i++)
        physicsScene.flippers[i].simulate(physicsScene.dt);

    for (var i = 0; i < physicsScene.balls.length; i++) {
        var ball = physicsScene.balls[i];
        ball.simulate(physicsScene.dt, physicsScene.gravity);

        for (var j = i + 1; j < physicsScene.balls.length; j++) {
            var ball2 = physicsScene.balls[j];
            handleBallBallCollision(ball, ball2, physicsScene.restitution);
        }

        for (var j = 0; j < physicsScene.obstacles.length; j++)
            handleBallObstacleCollision(ball, physicsScene.obstacles[j]);

        for (var j = 0; j < physicsScene.flippers.length; j++)
            handleBallFlipperCollision(ball, physicsScene.flippers[j]);

        handleBallBorderCollision(ball, physicsScene.border);

    }
}

// ---------------------------------------------------------------

function update() {
    simulate();
    draw();
    document.getElementById("score").innerHTML = physicsScene.score.toString();		
    requestAnimationFrame(update);
}

setupScene();
update();

// ------------------------ user interaction ---------------------------

canvas.addEventListener("touchstart", onTouchStart, false);
canvas.addEventListener("touchend", onTouchEnd, false);

canvas.addEventListener("mousedown", onMouseDown, false);
canvas.addEventListener("mouseup", onMouseUp, false);

function onTouchStart(event)
{
    for (var i = 0; i < event.touches.length; i++) {
        var touch = event.touches[i];

        var rect = canvas.getBoundingClientRect();	
        var touchPos = new Vector2(
            (touch.clientX - rect.left) / cScale, 
            simHeight - (touch.clientY - rect.top) / cScale);

        for (var j = 0; j < physicsScene.flippers.length; j++) {
            var flipper = physicsScene.flippers[j];
            if (flipper.select(touchPos)) 
                flipper.touchIdentifier = touch.identifier;
        }
    }
}

function onTouchEnd(event)
{
    for (var i = 0; i < physicsScene.flippers.length; i++) {
        var flipper = physicsScene.flippers[i];
        if (flipper.touchIdentifier < 0)
            continue;
        var found = false;
        for (var j = 0; j < event.touches.length; j++) {
            if (event.touches[j].touchIdentifier == flipper.touchIdentifier)
                found = true;
        }
        if (!found)
            flipper.touchIdentifier = -1;
    }
}

function onMouseDown(event)
{
    var rect = canvas.getBoundingClientRect();	
    var mousePos = new Vector2(
        (event.clientX - rect.left) / cScale, 
        simHeight - (event.clientY - rect.top) / cScale);

    for (var j = 0; j < physicsScene.flippers.length; j++) {
        var flipper = physicsScene.flippers[j];
        if (flipper.select(mousePos)) 
            flipper.touchIdentifier = 0;
    }
}

function onMouseUp(event)
{
    for (var i = 0; i < physicsScene.flippers.length; i++) 
        physicsScene.flippers[i].touchIdentifier = -1;
}	
