import { Row, Col } from "antd"
import { useContext } from 'react';
import { ReplContext } from '../../hooks/repl-context';
import type { MemoryT } from "../../hooks/use-memory";
import { ThemeContext } from "../../hooks/theme-context";

export default function SystemArea() {
    const replContext = useContext(ReplContext)
    const theme = useContext(ThemeContext)

    return (
        <div style={{height: '100%', width: '100%', backgroundColor: theme.background.gray, padding: 10, overflow: 'scroll'}}>
            { replContext.state === 'activated' &&
                <div>
                    <div style={{marginBottom:20}}>
                    <MemoryData memory={replContext.iram} showFigure={true} />
                    </div>
                    <div style={{marginBottom:20}}>
                    <MemoryData memory={replContext.dram} showFigure={false} />
                    </div>
                    <div style={{marginBottom:20}}>
                    <MemoryData memory={replContext.iflash} showFigure={false} />
                    </div>
                </div>
            }
        </div>
    )
}

function MemoryData(props: {memory: MemoryT, showFigure: boolean}) {
    const theme = useContext(ThemeContext)

    const size = Math.round(props.memory.state.size / 1000 * 100) / 100
    const usedSize = Math.round(props.memory.state.usedSize / 1000 * 100) / 100
    const usageRatio = Math.round(props.memory.state.usedSize / props.memory.state.size * 100 * 100) / 100

    return (
        <div style={{fontSize: 16}}>
            <div style={{fontWeight: 'bold'}}>{props.memory.state.name}</div>
            <div style={{color: theme.text.gray2}}>Used: &nbsp;  {usageRatio} % ({usedSize} KB / {size} KB)</div>
            { props.showFigure &&
                <div style={{marginTop:5}}><Memory buffer={props.memory.state.buffer}></Memory></div>
            }
        </div>
    )
}

function Memory(props: {buffer: boolean[]}) {
    const theme = useContext(ThemeContext)

    return (
        <Row>
            {props.buffer.map((value, index) => {
                const key = `col-${index}`
                return (
                    <Col key={key} flex={'1%'}
                    style={{
                        backgroundColor: value ? theme.blue : theme.gray, 
                        height: 8, border: `solid ${theme.background.gray} 0.03px`}}
                    >
                    </Col>
                )
            })
            }
        </Row>
    )
}