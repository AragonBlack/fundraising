import { breakpoint, font, theme } from '@aragon/ui'
import { endOfDay, format as formatDate, isAfter, isBefore, isDate, isEqual, startOfDay } from 'date-fns'
import PropTypes from 'prop-types'
import React from 'react'
import styled from 'styled-components'
import IconCalendar from './Calendar'
import DatePicker from './DatePicker'
import TextInput from './TextInput'

const DATE_PLACEHOLDER = '--/--/----'

class DateRangeInput extends React.PureComponent {
  state = {
    showPicker: false,
    startDate: this.props.startDate,
    endDate: this.props.endDate,
    startPicker: null,
    endPicker: null,
    startDateSelected: false,
    endDateSelected: false,
  }

  get formattedStartDate() {
    const { startDate } = this.state

    return isDate(startDate) ? formatDate(startDate, this.props.format) : ''
  }

  get formattedEndDate() {
    const { endDate, startDate } = this.state
    const { format } = this.props

    return isDate(endDate) ? formatDate(endDate, format) : ''
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.showPicker !== prevState.showPicker) {
      if (this.state.showPicker) {
        document.addEventListener('mousedown', this.handleClickOutside)
      } else {
        document.removeEventListener('mousedown', this.handleClickOutside)
      }
    }
  }

  handleClick = event => {
    event.stopPropagation()
    this.setState({ showPicker: true })
  }

  handleClickOutside = event => {
    if (this.rootRef && !this.rootRef.contains(event.target)) {
      this.setState({ showPicker: false })
    }
  }

  handleApply = () => {
    const { startDate, endDate } = this.state
    if (startDate && endDate) {
      this.props.onChange({
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      })
    }
  }

  handleClear = () => {
    this.setState({ startDate: new Date(), endDate: new Date() })
    this.props.onChange({
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    })
  }

  handleSelectStartDate = date => {
    const { endDate } = this.state
    const isValidDate = !endDate || isBefore(date, endDate) || isEqual(date, endDate)
    if (isValidDate) {
      this.setState({ startDateSelected: true, startDate: startOfDay(date) })
    }
  }

  handleSelectEndDate = date => {
    const { startDate } = this.state
    const isValidDate = !startDate || isAfter(date, startDate) || isEqual(date, startDate)
    if (isValidDate) {
      this.setState({ endDateSelected: true, endDate: endOfDay(date) })
    }
  }

  render() {
    const { startDate, endDate, showPicker } = this.state
    const { active, onClick } = this.props

    const icon = showPicker || active ? <IconCalendarSelected /> : <IconCalendar />
    const value = this.formattedStartDate && this.formattedEndDate ? `${this.formattedStartDate} - ${this.formattedEndDate}` : ''
    const placeholder = `Start date - End date`
    return (
      <StyledContainer
        ref={el => (this.rootRef = el)}
        onClick={() => {
          onClick()
          this.setState({ showPicker: true })
        }}
      >
        <StyledTextInput value={value} readOnly adornment={icon} adornmentPosition="end" height={39} placeholder={placeholder} />
        {showPicker && (
          <StyledDatePickersContainer>
            <DatePicker
              key={`start-picker-${startDate}`}
              name="start-date-picker"
              currentDate={startDate}
              onSelect={this.handleSelectStartDate}
              overlay={false}
            />
            <DatePicker
              key={`end-picker-${endDate}`}
              name="end-date-picker"
              currentDate={endDate}
              onSelect={this.handleSelectEndDate}
              onApply={this.handleApply}
              onClear={this.handleClear}
              overlay={false}
            />
          </StyledDatePickersContainer>
        )}
      </StyledContainer>
    )
  }
}

DateRangeInput.propTypes = {
  endDate: PropTypes.instanceOf(Date),
  format: PropTypes.string,
  onChange: PropTypes.func,
  startDate: PropTypes.instanceOf(Date),
}

DateRangeInput.defaultProps = {
  format: 'LL/dd/yyyy',
  onChange: () => {},
}

const StyledContainer = styled.div`
  position: relative;
`

const StyledTextInput = styled(TextInput)`
  width: 28ch;
  ${font({ monospace: true })};
  &:hover {
    cursor: pointer;
  }
`

const StyledDatePickersContainer = styled.div`
  position: absolute;
  z-index: 10;
  border: 1px solid ${theme.contentBorder};
  border-radius: 3px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  background: white;

  > div {
    border: 0;
    box-shadow: none;
  }

  ${breakpoint(
    'large',
    `
      display: flex;
      flex-direction: row;
      align-items: baseline;
    `
  )}
`

const IconCalendarSelected = styled(IconCalendar)`
  color: ${theme.accent};
`

export default DateRangeInput
