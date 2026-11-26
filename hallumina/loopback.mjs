// Loaded by Node in the game process AND its native worker threads. Upstream
// hard-codes wildcard listeners; confine TCP, HTTP and WS without source patches.
import net from 'node:net';
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
    if (typeof args[0] === 'object' && args[0] !== null) {
        if (!('port' in args[0])) throw new Error('Hallumina requires TCP loopback listeners.');
        args[0] = { ...args[0], host: '127.0.0.1' };
    } else if (typeof args[0] === 'number') {
        if (typeof args[1] === 'string') args[1] = '127.0.0.1';
        else args.splice(1, 0, '127.0.0.1');
    } else throw new Error('Unsupported listener; refusing a potentially public binding.');
    return listen.apply(this, args);
};
